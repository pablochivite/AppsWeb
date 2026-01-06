// Athlete Calendar View Manager
import { getCalendarViewPreference, saveCalendarViewPreference, getTrainingSystem } from '../core/storage.js';

export class AthleteCalendarManager {
    constructor() {
        this.calendarType = 'athlete';
        this.currentView = getCalendarViewPreference(this.calendarType);
        this.currentDate = new Date();
        this.scrollThreshold = 50;
        this.scrollDelta = 0;
        // Init will be called and handled asynchronously
        this.init().catch(err => console.error('Error initializing calendar:', err));
    }

    async init() {
        this.toggle = document.querySelector(`[data-calendar="${this.calendarType}"] .calendar-toggle`);
        this.grid = document.getElementById(`calendar-grid-${this.calendarType}`);
        this.container = document.querySelector(`.calendar-container[data-calendar="${this.calendarType}"]`);
        
        if (this.toggle && this.grid && this.container) {
            this.setupToggle();
            this.setupScroll();
            await this.renderCalendar();
        }
    }

    loadViewPreference() {
        return getCalendarViewPreference(this.calendarType);
    }

    saveViewPreference(view) {
        saveCalendarViewPreference(this.calendarType, view);
    }

    setupToggle() {
        // Set initial toggle state
        this.toggle.setAttribute('data-view', this.currentView);
        this.updateToggleLabels();
        
        // Toggle click handler
        this.toggle.addEventListener('click', () => {
            this.switchView().catch(err => console.error('Error switching view:', err));
        });
    }

    updateToggleLabels() {
        const labels = this.toggle.querySelectorAll('.toggle-label');
        labels.forEach((label, index) => {
            if (this.currentView === 'weekly' && index === 0) {
                label.classList.add('toggle-label-active');
                label.classList.remove('toggle-label-inactive');
            } else if (this.currentView === 'monthly' && index === 1) {
                label.classList.add('toggle-label-active');
                label.classList.remove('toggle-label-inactive');
            } else {
                label.classList.remove('toggle-label-active');
                label.classList.add('toggle-label-inactive');
            }
        });
    }

    async switchView() {
        this.currentView = this.currentView === 'weekly' ? 'monthly' : 'weekly';
        this.toggle.setAttribute('data-view', this.currentView);
        this.saveViewPreference(this.currentView);
        this.updateToggleLabels();
        await this.renderCalendar();
    }

    setupScroll() {
        if (!this.container) return;
        
        let isScrolling = false;
        
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            if (isScrolling) return;
            
            this.scrollDelta += e.deltaY;
            
            if (Math.abs(this.scrollDelta) > this.scrollThreshold) {
                isScrolling = true;
                
                if (this.scrollDelta > 0) {
                    // Scroll down - next period
                    this.navigateNext().catch(err => console.error('Error navigating next:', err));
                } else {
                    // Scroll up - previous period
                    this.navigatePrevious().catch(err => console.error('Error navigating previous:', err));
                }
                
                this.scrollDelta = 0;
                
                setTimeout(() => {
                    isScrolling = false;
                }, 300);
            }
        }, { passive: false });
    }

    async navigateNext() {
        if (this.currentView === 'weekly') {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
        } else {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        }
        await this.renderCalendar();
    }

    async navigatePrevious() {
        if (this.currentView === 'weekly') {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
        } else {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        }
        await this.renderCalendar();
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
    }

    getWeekDays(startDate) {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(startDate);
            day.setDate(startDate.getDate() + i);
            days.push(day);
        }
        return days;
    }

    getMonthDays(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        const days = [];
        
        // Add days from previous month
        const prevMonth = new Date(year, month - 1, 0);
        const prevMonthDays = prevMonth.getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            days.push({
                date: new Date(year, month - 1, prevMonthDays - i),
                isCurrentMonth: false
            });
        }
        
        // Add days from current month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({
                date: new Date(year, month, i),
                isCurrentMonth: true
            });
        }
        
        // Add days from next month to fill the grid
        const remainingDays = 42 - days.length; // 6 weeks * 7 days
        for (let i = 1; i <= remainingDays; i++) {
            days.push({
                date: new Date(year, month + 1, i),
                isCurrentMonth: false
            });
        }
        
        return days;
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    async renderCalendar() {
        if (!this.grid) return;
        
        // Fade out
        this.grid.classList.add('fade-out');
        
        setTimeout(async () => {
            this.grid.innerHTML = '';
            this.grid.className = `calendar-grid ${this.currentView}-view`;
            
            if (this.currentView === 'weekly') {
                await this.renderWeeklyView();
            } else {
                await this.renderMonthlyView();
            }
            
            // Fade in
            this.grid.classList.remove('fade-out');
            this.grid.classList.add('fade-in');
        }, 150);
    }

    async renderWeeklyView() {
        const weekStart = this.getWeekStart(this.currentDate);
        const weekDays = this.getWeekDays(weekStart);
        const today = new Date();
        const trainingSystem = await getTrainingSystem();
        
        weekDays.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            
            if (this.isToday(day)) {
                dayElement.classList.add('today');
            }
            
            // Find session for this day
            const session = this.getSessionForDate(day, trainingSystem);
            
            dayElement.innerHTML = `
                <div class="calendar-day-number">${day.getDate()}</div>
                <div class="calendar-day-events">${session ? this.formatSessionBadge(session) : ''}</div>
            `;
            
            this.grid.appendChild(dayElement);
        });
    }

    async renderMonthlyView() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const monthDays = this.getMonthDays(year, month);
        const today = new Date();
        const trainingSystem = await getTrainingSystem();
        
        monthDays.forEach(({ date, isCurrentMonth }) => {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            
            if (!isCurrentMonth) {
                dayElement.classList.add('other-month');
            }
            
            if (isCurrentMonth && this.isToday(date)) {
                dayElement.classList.add('today');
            }
            
            // Find session for this day
            const session = isCurrentMonth ? this.getSessionForDate(date, trainingSystem) : null;
            
            dayElement.innerHTML = `
                <div class="calendar-day-number">${date.getDate()}</div>
                <div class="calendar-day-events">${session ? this.formatSessionBadge(session) : ''}</div>
            `;
            
            this.grid.appendChild(dayElement);
        });
    }

    /**
     * Get session for a specific date
     * @param {Date} date - Date to find session for
     * @param {Object} trainingSystem - Training system object
     * @returns {Object|null} Session or null
     */
    getSessionForDate(date, trainingSystem) {
        if (!trainingSystem || !trainingSystem.sessions) return null;
        
        const dateStr = date.toISOString().split('T')[0];
        
        return trainingSystem.sessions.find(session => {
            if (session.date === dateStr) return true;
            
            // Also check by day offset from start date
            if (trainingSystem.startDate) {
                const startDate = new Date(trainingSystem.startDate);
                const daysDiff = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
                return session.day === daysDiff + 1;
            }
            
            return false;
        }) || null;
    }

    /**
     * Format session badge for calendar display
     * @param {Object} session - Session object
     * @returns {string} HTML string for badge
     */
    formatSessionBadge(session) {
        if (!session) return '';
        
        const workout = session.workout || 'Workout';
        const discipline = session.discipline || '';
        const isToday = this.isToday(new Date(session.date || new Date()));
        
        const badgeClass = isToday 
            ? 'bg-white text-black' 
            : 'bg-white/20 text-white';
        
        return `
            <div class="calendar-session-badge ${badgeClass} text-xs px-2 py-1 rounded-full mt-1 font-medium">
                ${workout}
            </div>
        `;
    }
}

