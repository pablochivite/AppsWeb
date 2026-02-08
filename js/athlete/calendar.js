// Athlete Calendar View Manager
import { getCalendarViewPreference, saveCalendarViewPreference, getTrainingSystem } from '../core/storage.js';
import { cleanFrameworkName } from '../core/constants.js';
import { formatDisciplines } from '../core/ui-utils.js';

export class AthleteCalendarManager {
    constructor() {
        this.calendarType = 'athlete';
        this.currentView = getCalendarViewPreference(this.calendarType);
        this.currentDate = new Date();
        this.scrollThreshold = 50;
        this.scrollDelta = 0;
        // Drag detection for click vs drag
        this.isDragging = false;
        this.dragStartPos = null;
        this.dragThreshold = 5; // pixels
        // Modal reference
        this.sessionDetailModal = null;
        // Init will be called and handled asynchronously
        this.init().catch(err => console.error('Error initializing calendar:', err));
    }

    async init() {
        this.toggle = document.querySelector(`[data-calendar="${this.calendarType}"] .calendar-toggle`);
        this.grid = document.getElementById(`calendar-grid-${this.calendarType}`);
        this.container = document.querySelector(`.calendar-container[data-calendar="${this.calendarType}"]`);
        
        if (this.toggle && this.grid && this.container) {
            // Load modal template first and wait for it to complete
            await this.loadModalTemplate();
            // Verify modal was loaded
            if (!this.sessionDetailModal) {
                console.error('[Calendar] Modal failed to load during init');
            }
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
        firstDay.setHours(0, 0, 0, 0);
        const lastDay = new Date(year, month + 1, 0);
        lastDay.setHours(0, 0, 0, 0);
        const daysInMonth = lastDay.getDate();
        // Convert to Monday-first week: Sunday (0) -> 6, Monday (1) -> 0, Tuesday (2) -> 1, etc.
        const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        
        const days = [];
        
        // Add days from previous month
        const prevMonth = new Date(year, month - 1, 0);
        prevMonth.setHours(0, 0, 0, 0);
        const prevMonthDays = prevMonth.getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, prevMonthDays - i);
            date.setHours(0, 0, 0, 0);
            days.push({
                date: date,
                isCurrentMonth: false
            });
        }
        
        // Add days from current month
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            date.setHours(0, 0, 0, 0);
            days.push({
                date: date,
                isCurrentMonth: true
            });
        }
        
        // Add days from next month to fill the grid
        const remainingDays = 42 - days.length; // 6 weeks * 7 days
        for (let i = 1; i <= remainingDays; i++) {
            const date = new Date(year, month + 1, i);
            date.setHours(0, 0, 0, 0);
            days.push({
                date: date,
                isCurrentMonth: false
            });
        }
        
        return days;
    }

    isToday(date) {
        const today = new Date();
        // Normalize both dates to midnight for accurate comparison
        const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const dateNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return dateNormalized.getTime() === todayNormalized.getTime();
    }

    /**
     * Format a Date object to YYYY-MM-DD string in local timezone
     * @param {Date} date - Date object to format
     * @returns {string} Date string in YYYY-MM-DD format (local timezone)
     */
    formatLocalDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get today's date as YYYY-MM-DD string in local timezone
     * @returns {string} Today's date string in YYYY-MM-DD format
     */
    getTodayLocalDateString() {
        const today = new Date();
        return this.formatLocalDate(today);
    }

    /**
     * Parse a YYYY-MM-DD string to Date object in local timezone
     * @param {string} dateStr - Date string in YYYY-MM-DD format
     * @returns {Date} Date object in local timezone
     */
    parseLocalDateString(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') {
            return new Date();
        }
        const parts = dateStr.split('-');
        if (parts.length !== 3) {
            return new Date(dateStr);
        }
        // Create date in local timezone (month is 0-indexed)
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }

    /**
     * Check if a date string or Date object represents today (local timezone)
     * @param {Date|string} date - Date object or date string
     * @returns {boolean} True if date is today
     */
    isTodayLocal(date) {
        const todayStr = this.getTodayLocalDateString();
        if (date instanceof Date) {
            return this.formatLocalDate(date) === todayStr;
        }
        // If it's a string, compare directly
        const dateStr = typeof date === 'string' ? date.split('T')[0] : date;
        return dateStr === todayStr;
    }

    /**
     * Render month header showing current month and year
     * Only shown in monthly view
     */
    renderMonthHeader() {
        if (!this.container) return;
        
        // Remove existing month header if any
        const existingHeader = this.container.querySelector('.calendar-month-header');
        if (existingHeader) {
            existingHeader.remove();
        }
        
        // Only show header in monthly view
        if (this.currentView !== 'monthly') {
            return;
        }
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Format month name (using browser locale)
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[month];
        
        // Create header element
        const header = document.createElement('div');
        header.className = 'calendar-month-header text-center mb-6';
        header.innerHTML = `
            <h3 class="text-2xl font-bold text-white">${monthName} ${year}</h3>
        `;
        
        // Insert before the calendar-header (days of week)
        const calendarHeader = this.container.querySelector('.calendar-header');
        if (calendarHeader) {
            this.container.insertBefore(header, calendarHeader);
        } else {
            // If no calendar-header found, insert before grid
            this.container.insertBefore(header, this.grid);
        }
    }

    async renderCalendar() {
        if (!this.grid) return;
        
        // Render month header if in monthly view
        this.renderMonthHeader();
        
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
            
            // Setup drag-and-drop after rendering
            this.setupDragAndDrop();
            
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
            const dateStr = this.formatLocalDate(day);
            
            dayElement.innerHTML = `
                <div class="calendar-day-number">${day.getDate()}</div>
                <div class="calendar-day-events">${session ? this.formatSessionBadge(session, dateStr) : ''}</div>
            `;
            
            // Add data attribute for drop target
            dayElement.setAttribute('data-date', dateStr);
            dayElement.classList.add('calendar-day-drop-target');
            
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
            const dateStr = this.formatLocalDate(date);
            
            dayElement.innerHTML = `
                <div class="calendar-day-number">${date.getDate()}</div>
                <div class="calendar-day-events">${session ? this.formatSessionBadge(session, dateStr) : ''}</div>
            `;
            
            // Add data attribute for drop target (only for current month days)
            if (isCurrentMonth) {
                dayElement.setAttribute('data-date', dateStr);
                dayElement.classList.add('calendar-day-drop-target');
            }
            
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
        if (!trainingSystem) return null;
        if (!trainingSystem.sessions || !Array.isArray(trainingSystem.sessions) || trainingSystem.sessions.length === 0) {
            return null;
        }
        
        const dateStr = this.formatLocalDate(date);
        const dateDayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // PRIORITY 1: Check for sessions with exact date match (moved/rescheduled sessions)
        // This allows moved sessions to override the weekly pattern
        const sessionWithExactDate = trainingSystem.sessions.find(session => {
            if (!session || !session.date) return false;
            // Normalize session date for comparison (always use local timezone)
            const sessionDateStr = typeof session.date === 'string' 
                ? session.date.split('T')[0] 
                : this.formatLocalDate(new Date(session.date));
            return sessionDateStr === dateStr;
        });
        
        if (sessionWithExactDate) {
            // Found a session with exact date match - return it
            // BUT: First validate that it's not before the training system start date
            const checkDate = new Date(date);
            checkDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Check if date is before the training system start date
            if (trainingSystem.startDate) {
                const startDate = new Date(trainingSystem.startDate);
                startDate.setHours(0, 0, 0, 0);
                
                // Don't show sessions before the start date
                if (checkDate.getTime() < startDate.getTime()) {
                    return null;
                }
            }
            
            // Allow today and future dates
            if (checkDate.getTime() >= today.getTime()) {
                return {
                    ...sessionWithExactDate,
                    date: dateStr,
                    dayOfWeek: dateDayOfWeek,
                    framework: sessionWithExactDate.framework || sessionWithExactDate.workout || sessionWithExactDate.workoutType
                };
            }
            // If it's a past date, don't show it (unless it's today)
            return null;
        }
        
        // PRIORITY 2: Fall back to weekly pattern logic (original behavior)
        // Check if this day of week is a training day
        if (!trainingSystem.trainingDaysOfWeek || !Array.isArray(trainingSystem.trainingDaysOfWeek) || trainingSystem.trainingDaysOfWeek.length === 0) {
            return null;
        }
        
        const dayIndex = trainingSystem.trainingDaysOfWeek.indexOf(dateDayOfWeek);
        if (dayIndex < 0 || dayIndex >= trainingSystem.sessions.length) {
            return null;
        }
        
        const sessionTemplate = trainingSystem.sessions[dayIndex];
        if (!sessionTemplate) {
            return null;
        }
        
        // Check if there's a moved session that originally belonged to this date
        // A session is "moved" if it has the same dayOfWeek as the template but a date that doesn't match its dayOfWeek
        // We need to check if any session with this dayOfWeek was moved from this specific week
        const movedSessionFromThisWeek = trainingSystem.sessions.find(session => {
            if (!session || !session.date || session.dayOfWeek === undefined) return false;
            
            // Check if this session has the same dayOfWeek as the date we're checking
            if (session.dayOfWeek !== dateDayOfWeek) return false;
            
            // Check if this session's date doesn't match its dayOfWeek (it was moved)
            const sessionDateStr = typeof session.date === 'string' 
                ? session.date.split('T')[0] 
                : this.formatLocalDate(new Date(session.date));
            const sessionDate = this.parseLocalDateString(sessionDateStr);
            const sessionDateDayOfWeek = sessionDate.getDay();
            
            // If the session's date doesn't match its dayOfWeek, it was moved
            if (sessionDateDayOfWeek !== session.dayOfWeek) {
                // Check if this moved session is from the same week as the date we're checking
                const checkDate = new Date(date);
                const sessionWeekStart = this.getWeekStart(sessionDate);
                const checkWeekStart = this.getWeekStart(checkDate);
                
                // If it's in the same week, this session was moved from its original position in this week
                return sessionWeekStart.getTime() === checkWeekStart.getTime();
            }
            
            return false;
        });
        
        // If there's a moved session from this week with this dayOfWeek, don't show the pattern
        // The session was moved from its original position, so the pattern shouldn't show for this specific week
        if (movedSessionFromThisWeek) {
            return null;
        }
        
        // Normalize dates for comparison
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get week starts for comparison
        const checkWeekStart = this.getWeekStart(checkDate);
        checkWeekStart.setHours(0, 0, 0, 0);
        const todayWeekStart = this.getWeekStart(today);
        todayWeekStart.setHours(0, 0, 0, 0);
        
        // Check if date is before the training system start date
        // Don't show any training days before the generation week
        if (trainingSystem.startDate) {
            const startDate = new Date(trainingSystem.startDate);
            startDate.setHours(0, 0, 0, 0);
            const startWeekStart = this.getWeekStart(startDate);
            startWeekStart.setHours(0, 0, 0, 0);
            
            // Don't show dates before the start week (generation week)
            // Use strict comparison: only show dates in the start week or later
            if (checkWeekStart.getTime() < startWeekStart.getTime()) {
                return null;
            }
            
            // Also check: if we're in the start week, only show dates on or after the startDate
            // (This handles cases where startDate might be mid-week, though it should be Monday)
            if (checkWeekStart.getTime() === startWeekStart.getTime()) {
                if (checkDate.getTime() < startDate.getTime()) {
                    return null;
                }
            }
        }
        
        // For the current week: only show today and future training days
        // For future weeks: show all training days
        if (checkWeekStart.getTime() === todayWeekStart.getTime()) {
            // Current week: only show today or future days
            if (checkDate.getTime() < today.getTime()) {
                return null;
            }
        }
        // For future weeks, show all training days (no additional check needed)
        
        // Create a new object without the 'id' field since this is a pattern session
        // (not an actual created session - PRIORITY 1 failed, so no exact date match exists)
        const { id, ...sessionWithoutId } = sessionTemplate;
        return {
            ...sessionWithoutId,
            date: dateStr,
            dayOfWeek: dateDayOfWeek,
            framework: sessionTemplate.framework || sessionTemplate.workout || sessionTemplate.workoutType
        };
    }
    
    /**
     * Check if a session has been moved from its original day of week
     * A session is "moved" if its date doesn't match its expected dayOfWeek
     * Initial sessions have dates that match their dayOfWeek pattern
     * @param {Object} session - Session object
     * @param {number} expectedDayOfWeek - Expected day of week (0=Sunday, 1=Monday, etc.)
     * @returns {boolean} True if session was moved (date doesn't match dayOfWeek)
     */
    isSessionMoved(session, expectedDayOfWeek) {
        if (!session || !session.date) {
            // No date means it's a template - not moved
            return false;
        }
        
        // Get the day of week from the session's date
        const sessionDate = typeof session.date === 'string' 
            ? this.parseLocalDateString(session.date)
            : new Date(session.date);
        const sessionDayOfWeek = sessionDate.getDay();
        
        // If the session's date matches its expected day of week, it's an initial session (not moved)
        // If it doesn't match, it was moved
        return sessionDayOfWeek !== expectedDayOfWeek;
    }

    /**
     * Get the start of the week (Monday) for a given date
     * @param {Date} date - Date to get week start for
     * @returns {Date} Monday of that week
     */
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const weekStart = new Date(d.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
    }

    /**
     * Extract framework name from a potentially combined "Discipline - Framework" string
     * Uses the cleanFrameworkName utility to remove discipline names
     * @param {string} label - Potentially combined label
     * @returns {string} Framework name only
     */
    extractFrameworkName(label) {
        if (!label) return 'Workout';
        
        // Use the utility to clean the framework name
        return cleanFrameworkName(label);
    }

    /**
     * Setup drag-and-drop functionality for session badges
     */
    setupDragAndDrop() {
        if (!this.grid) return;
        
        // Store dragged session data in instance variable to persist across events
        this.draggedSession = null;
        this.draggedElement = null;
        
        // Find all session badges and make them draggable
        const badges = this.grid.querySelectorAll('.calendar-session-badge');
        badges.forEach(badge => {
            // Track drag state
            let isDraggingThisBadge = false;
            
            // Handle double click event - this won't interfere with drag and drop
            badge.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const sessionId = badge.getAttribute('data-session-id');
                const sessionDate = badge.getAttribute('data-session-date');
                if (sessionId) {
                    // Get session data from training system
                    this.getSessionForClick(sessionDate).then(session => {
                        if (session && session.id) {
                            this.handleSessionBadgeClick(session, sessionDate);
                        }
                    }).catch(err => console.error('Error getting session for click:', err));
                }
            });
            
            badge.addEventListener('dragstart', (e) => {
                isDraggingThisBadge = true;
                this.isDragging = true;
                
                this.draggedSession = {
                    id: badge.getAttribute('data-session-id'),
                    date: badge.getAttribute('data-session-date'),
                    framework: badge.getAttribute('data-session-framework'),
                    discipline: badge.getAttribute('data-session-discipline'),
                    workout: badge.getAttribute('data-session-workout')
                };
                this.draggedElement = badge;
                e.dataTransfer.effectAllowed = 'move';
                // Store session data in dataTransfer for cross-event access
                e.dataTransfer.setData('application/json', JSON.stringify(this.draggedSession));
                e.dataTransfer.setData('text/plain', this.draggedSession.id || ''); // Fallback
                badge.style.opacity = '0.5';
                console.log('[Drag] Started dragging session:', this.draggedSession);
            });
            
            badge.addEventListener('dragend', (e) => {
                isDraggingThisBadge = false;
                this.isDragging = false;
                
                if (this.draggedElement) {
                    this.draggedElement.style.opacity = '';
                }
                
                // Remove all drop indicators
                this.grid.querySelectorAll('.calendar-day').forEach(day => {
                    day.classList.remove('drag-over', 'drop-valid', 'drop-invalid');
                });
                
                // Only clear if drop was successful (check if drop event fired)
                // If drop was cancelled, keep the data for potential retry
                if (e.dataTransfer.dropEffect === 'none') {
                    console.log('[Drag] Drag ended without drop');
                }
                
                // Clear after a short delay to allow drop event to fire
                setTimeout(() => {
                    this.draggedSession = null;
                    this.draggedElement = null;
                }, 100);
            });
            
            // Handle double click event - this won't interfere with drag and drop
            badge.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const sessionId = badge.getAttribute('data-session-id');
                const sessionDate = badge.getAttribute('data-session-date');
                if (sessionId) {
                    // Get session data from training system
                    this.getSessionForClick(sessionDate).then(session => {
                        if (session && session.id) {
                            this.handleSessionBadgeClick(session, sessionDate);
                        }
                    }).catch(err => console.error('Error getting session for click:', err));
                }
            });
        });
        
        // Setup drop targets for calendar days
        const dayElements = this.grid.querySelectorAll('.calendar-day-drop-target');
        dayElements.forEach(dayElement => {
            dayElement.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                
                // Try to get dragged session from instance or dataTransfer
                let draggedSession = this.draggedSession;
                if (!draggedSession) {
                    try {
                        const data = e.dataTransfer.getData('application/json');
                        if (data) {
                            draggedSession = JSON.parse(data);
                        }
                    } catch (err) {
                        // Fallback to text/plain
                        const sessionId = e.dataTransfer.getData('text/plain');
                        if (sessionId) {
                            // We can't reconstruct full session, but we can still allow drop
                            draggedSession = { id: sessionId };
                        }
                    }
                }
                
                if (!draggedSession) return;
                
                const targetDate = dayElement.getAttribute('data-date');
                if (!targetDate) return;
                
                // Get today's date string for comparison (using local timezone)
                const todayStr = this.getTodayLocalDateString();
                
                // Check if drop is valid (today or future dates only) - compare as strings
                const isValid = targetDate >= todayStr;
                
                // Remove classes from all days
                dayElements.forEach(d => {
                    d.classList.remove('drag-over', 'drop-valid', 'drop-invalid');
                });
                
                // Add appropriate class to current day
                if (isValid) {
                    dayElement.classList.add('drag-over', 'drop-valid');
                } else {
                    dayElement.classList.add('drag-over', 'drop-invalid');
                }
            });
            
            dayElement.addEventListener('dragleave', (e) => {
                // Only remove classes if we're actually leaving the element
                if (!dayElement.contains(e.relatedTarget)) {
                    dayElement.classList.remove('drag-over', 'drop-valid', 'drop-invalid');
                }
            });
            
            dayElement.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('[Drop] Drop event fired');
                
                // Try to get dragged session from instance or dataTransfer
                let draggedSession = this.draggedSession;
                if (!draggedSession) {
                    try {
                        const data = e.dataTransfer.getData('application/json');
                        if (data) {
                            draggedSession = JSON.parse(data);
                            console.log('[Drop] Recovered session from dataTransfer:', draggedSession);
                        }
                    } catch (err) {
                        console.error('[Drop] Error parsing session data:', err);
                    }
                }
                
                if (!draggedSession) {
                    console.warn('[Drop] No dragged session data available');
                    dayElement.classList.remove('drag-over', 'drop-valid', 'drop-invalid');
                    return;
                }
                
                const targetDate = dayElement.getAttribute('data-date');
                if (!targetDate) {
                    console.warn('[Drop] No target date found');
                    dayElement.classList.remove('drag-over', 'drop-valid', 'drop-invalid');
                    return;
                }
                
                console.log('[Drop] Dropping session', draggedSession.id, 'from', draggedSession.date, 'to', targetDate);
                
                // Parse date string (YYYY-MM-DD) correctly in local timezone
                const targetDateObj = this.parseLocalDateString(targetDate);
                targetDateObj.setHours(0, 0, 0, 0);
                
                // Get today's date string for comparison (using local timezone)
                const todayStr = this.getTodayLocalDateString();
                
                console.log('[Drop] Today:', todayStr, 'Target:', targetDate, 'Comparison:', targetDate >= todayStr);
                
                // Validate: only allow drops on today or future dates
                // Compare as strings first (simpler), then as dates if needed
                if (targetDate < todayStr) {
                    console.warn('[Drop] Cannot move session to past date. Today:', todayStr, 'Target:', targetDate);
                    dayElement.classList.remove('drag-over', 'drop-valid', 'drop-invalid');
                    return;
                }
                
                // If dropping on the same date, do nothing
                if (targetDate === draggedSession.date) {
                    console.log('[Drop] Dropping on same date, ignoring');
                    dayElement.classList.remove('drag-over', 'drop-valid', 'drop-invalid');
                    return;
                }
                
                // Check if target date already has a session
                const { getTrainingSystem } = await import('../core/storage.js');
                const trainingSystem = await getTrainingSystem();
                const existingSession = this.getSessionForDate(targetDateObj, trainingSystem);
                if (existingSession && existingSession.id && existingSession.id !== draggedSession.id) {
                    console.warn('[Drop] Target date already has a session');
                    dayElement.classList.remove('drag-over', 'drop-valid', 'drop-invalid');
                    return;
                }
                
                // Update or create session in Firebase
                try {
                    if (draggedSession.id) {
                        // Session exists, update it
                        console.log('[Drop] Updating session date...');
                        await this.updateSessionDate(draggedSession.id, targetDate);
                        console.log('[Drop] Session date updated successfully');
                    } else {
                        // Session is a pattern (no ID), create new session
                        console.log('[Drop] Creating session from pattern...');
                        await this.createSessionFromPattern(draggedSession, targetDate);
                        console.log('[Drop] Session created successfully');
                    }
                    
                    // Clear dragged session immediately
                    this.draggedSession = null;
                    this.draggedElement = null;
                    
                    // Re-render calendar to show updated session
                    await this.renderCalendar();
                    
                    // Clear training system cache to force fresh load on next access
                    // This ensures the homepage will see the updated session date
                    try {
                        const { getTrainingSystem } = await import('../core/storage.js');
                        const currentSystem = await getTrainingSystem();
                        if (currentSystem && currentSystem.id) {
                            // Remove localStorage cache to force fresh load
                            localStorage.removeItem('trainingSystem');
                            // Also clear the Firestore cache key
                            const cacheKey = `firestore_cache_training_system_${user.uid}_${currentSystem.id}`;
                            localStorage.removeItem(cacheKey);
                        }
                    } catch (error) {
                        console.warn('[Calendar] Failed to clear cache:', error.message);
                    }
                    
                    // Trigger dashboard refresh if on home page
                    if (typeof window.initDashboard === 'function') {
                        // Use setTimeout to ensure cache is cleared first
                        setTimeout(() => {
                            window.initDashboard();
                        }, 100);
                    }
                } catch (error) {
                    console.error('[Drop] Error moving session:', error);
                    alert('Error moving session. Please try again.');
                }
                
                // Clean up
                dayElement.classList.remove('drag-over', 'drop-valid', 'drop-invalid');
            });
        });
    }
    
    /**
     * Update session date in Firebase
     * @param {string} sessionId - Session ID
     * @param {string} newDate - New date string (YYYY-MM-DD)
     */
    async updateSessionDate(sessionId, newDate) {
        if (!sessionId) {
            throw new Error('Session ID is required');
        }
        
        const { getAuthUser } = await import('../core/auth-manager.js');
        const { saveSessionToSystem, getSystemSessions } = await import('../services/dbService.js');
        const { getTrainingSystem } = await import('../core/storage.js');
        
        const user = getAuthUser();
        if (!user) {
            throw new Error('User must be authenticated');
        }
        
        const trainingSystem = await getTrainingSystem();
        if (!trainingSystem || !trainingSystem.id) {
            throw new Error('Training system not found');
        }
        
        // Get the session from Firebase
        const sessions = await getSystemSessions(user.uid, trainingSystem.id);
        const session = sessions.find(s => s.id === sessionId);
        
        if (!session) {
            throw new Error('Session not found');
        }
        
        // Update session with new date
        // IMPORTANT: If session was completed on its original date, reset completed flag
        // when moving to a new date, so it can be done again on the new date
        const updatedSession = {
            ...session,
            date: newDate,
            id: sessionId,
            // Reset completed flag when moving to a new date
            // The session should be available to complete on its new date
            completed: false,
            completedAt: undefined
        };
        
        // Save to Firebase
        await saveSessionToSystem(user.uid, trainingSystem.id, updatedSession);
        
        // Update local cache
        if (trainingSystem.sessions) {
            const sessionIndex = trainingSystem.sessions.findIndex(s => s.id === sessionId);
            if (sessionIndex >= 0) {
                trainingSystem.sessions[sessionIndex] = updatedSession;
                const { saveTrainingSystem } = await import('../core/storage.js');
                await saveTrainingSystem(trainingSystem);
            }
        }
    }
    
    /**
     * Create a new session in Firebase from a pattern session (session without ID)
     * @param {Object} patternSession - Pattern session data from drag
     * @param {string} newDate - New date string (YYYY-MM-DD)
     */
    async createSessionFromPattern(patternSession, newDate) {
        const { getAuthUser } = await import('../core/auth-manager.js');
        const { saveSessionToSystem } = await import('../services/dbService.js');
        const { getTrainingSystem } = await import('../core/storage.js');
        
        const user = getAuthUser();
        if (!user) {
            throw new Error('User must be authenticated');
        }
        
        const trainingSystem = await getTrainingSystem();
        if (!trainingSystem || !trainingSystem.id) {
            throw new Error('Training system not found');
        }
        
        // Get the pattern session template from the training system
        const originalDate = patternSession.date ? this.parseLocalDateString(patternSession.date) : null;
        let sessionTemplate = null;
        
        if (originalDate && trainingSystem.trainingDaysOfWeek && trainingSystem.sessions) {
            // Find the template by matching the day of week
            const originalDayOfWeek = originalDate.getDay();
            const dayIndex = trainingSystem.trainingDaysOfWeek.indexOf(originalDayOfWeek);
            if (dayIndex >= 0 && dayIndex < trainingSystem.sessions.length) {
                sessionTemplate = trainingSystem.sessions[dayIndex];
            }
        }
        
        // If no template found, try to get session from the date
        if (!sessionTemplate && originalDate) {
            sessionTemplate = this.getSessionForDate(originalDate, trainingSystem);
        }
        
        // If still no template, create basic session from dragged data
        if (!sessionTemplate) {
            sessionTemplate = {
                framework: patternSession.framework,
                discipline: patternSession.discipline,
                workout: patternSession.workout,
                phases: { warmup: [], workout: [], cooldown: [] }
            };
        }
        
        // Create new session with new date
        const newDateObj = this.parseLocalDateString(newDate);
        const newSession = {
            ...sessionTemplate,
            date: newDate,
            dayOfWeek: originalDate ? originalDate.getDay() : newDateObj.getDay(),
            editable: true,
            completed: false
        };
        
        // Remove id if present (we want to create a new session)
        delete newSession.id;
        
        // Save to Firebase (this will create a new session)
        const newSessionId = await saveSessionToSystem(user.uid, trainingSystem.id, newSession);
        
        // Update local cache
        if (trainingSystem.sessions) {
            const sessionWithId = { ...newSession, id: newSessionId };
            trainingSystem.sessions.push(sessionWithId);
            const { saveTrainingSystem } = await import('../core/storage.js');
            await saveTrainingSystem(trainingSystem);
        }
        
        return newSessionId;
    }

    /**
     * Format session badge for calendar display
     * @param {Object} session - Session object
     * @param {string} dateStr - Date string for the session (YYYY-MM-DD)
     * @returns {string} HTML string for badge
     */
    formatSessionBadge(session, dateStr = null) {
        if (!session) return '';
        
        // Only show framework, not discipline
        // Extract framework name, stripping discipline if combined (e.g., "Animal Flow - Push" -> "Push")
        const rawFramework = session.framework || session.workout || 'Workout';
        const framework = this.extractFrameworkName(rawFramework);
        const sessionDate = dateStr || session.date || this.getTodayLocalDateString();
        // Parse session date to Date object for isToday check
        const sessionDateObj = sessionDate ? this.parseLocalDateString(sessionDate) : new Date();
        const isToday = this.isToday(sessionDateObj);
        
        const badgeClass = isToday 
            ? 'bg-white text-black' 
            : 'bg-white/20 text-white';
        
        // Store session data in data attributes for drag-and-drop
        const sessionId = session.id || '';
        const originalDate = session.date || sessionDate;
        
        // Add cursor-pointer if session has ID (is clickable)
        const cursorClass = sessionId ? 'cursor-pointer cursor-move' : 'cursor-move';
        
        return `
            <div class="calendar-session-badge ${badgeClass} text-xs px-2 py-1 rounded-full mt-1 font-medium ${cursorClass}"
                 draggable="true"
                 data-session-id="${sessionId}"
                 data-session-date="${originalDate}"
                 data-session-framework="${framework}"
                 data-session-discipline="${formatDisciplines(session.discipline) || ''}"
                 data-session-workout="${session.workout || ''}">
                ${framework}
            </div>
        `;
    }

    /**
     * Load session detail modal template
     */
    async loadModalTemplate() {
        try {
            console.log('[Calendar] Loading modal template...');
            
            // Check if modal already exists
            this.sessionDetailModal = document.getElementById('session-detail-modal');
            if (this.sessionDetailModal) {
                console.log('[Calendar] Modal already exists in DOM');
                this.setupModalEventListeners();
                return;
            }
            
            const { loadTemplate } = await import('../core/template-loader.js');
            const modalHTML = await loadTemplate('html/components/session-detail-modal.html');
            console.log('[Calendar] Modal template loaded, HTML length:', modalHTML.length);
            
            // Inject modal into body - use insertAdjacentHTML to ensure proper parsing
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            console.log('[Calendar] Modal injected into body using insertAdjacentHTML');
            
            // Get the element immediately after injection
            this.sessionDetailModal = document.getElementById('session-detail-modal');
            console.log('[Calendar] Modal element found:', !!this.sessionDetailModal);
            
            if (this.sessionDetailModal) {
                this.setupModalEventListeners();
                console.log('[Calendar] Modal event listeners setup complete');
            } else {
                console.error('[Calendar] Modal element not found after injection!');
                // Try one more time after a short delay
                await new Promise(resolve => setTimeout(resolve, 50));
                this.sessionDetailModal = document.getElementById('session-detail-modal');
                if (this.sessionDetailModal) {
                    console.log('[Calendar] Modal element found on retry');
                    this.setupModalEventListeners();
                } else {
                    console.error('[Calendar] Modal element still not found after retry');
                }
            }
        } catch (error) {
            console.error('[Calendar] Error loading session detail modal template:', error);
        }
    }

    /**
     * Setup event listeners for modal
     */
    setupModalEventListeners() {
        if (!this.sessionDetailModal) return;
        
        // Close button
        const closeBtn = this.sessionDetailModal.querySelector('#session-detail-modal-close');
        const closeBtnBottom = this.sessionDetailModal.querySelector('#session-detail-modal-close-btn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideSessionDetailModal());
        }
        
        if (closeBtnBottom) {
            closeBtnBottom.addEventListener('click', () => this.hideSessionDetailModal());
        }
        
        // Click outside to close
        this.sessionDetailModal.addEventListener('click', (e) => {
            if (e.target === this.sessionDetailModal) {
                this.hideSessionDetailModal();
            }
        });
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.sessionDetailModal.classList.contains('hidden')) {
                this.hideSessionDetailModal();
            }
        });
    }

    /**
     * Get session data for click handler
     * @param {string} dateStr - Date string
     * @returns {Promise<Object|null>} Session object or null
     */
    async getSessionForClick(dateStr) {
        try {
            const trainingSystem = await getTrainingSystem();
            if (!trainingSystem) return null;
            
            const date = this.parseLocalDateString(dateStr);
            return this.getSessionForDate(date, trainingSystem);
        } catch (error) {
            console.error('Error getting session for click:', error);
            return null;
        }
    }

    /**
     * Handle session badge click (with drag detection)
     * @param {Object} session - Session object
     * @param {string} dateStr - Date string
     */
    async handleSessionBadgeClick(session, dateStr) {
        console.log('[Calendar] handleSessionBadgeClick called with:', { session, dateStr });
        // Only show modal if session has ID (is created in Firebase)
        if (!session || !session.id) {
            console.warn('[Calendar] Session has no ID, returning');
            return; // Pattern session, not clickable
        }
        
        try {
            // Fetch full session from Firebase
            const { getAuthUser } = await import('../core/auth-manager.js');
            const { getSystemSession } = await import('../services/dbService.js');
            const { getTrainingSystem } = await import('../core/storage.js');
            
            const user = getAuthUser();
            if (!user) {
                console.warn('[Calendar] User not authenticated');
                return;
            }
            
            const trainingSystem = await getTrainingSystem();
            if (!trainingSystem || !trainingSystem.id) {
                console.warn('[Calendar] Training system not found');
                return;
            }
            
            console.log('[Calendar] Fetching session from Firebase:', { userId: user.uid, systemId: trainingSystem.id, sessionId: session.id });
            // Fetch full session details
            const fullSession = await getSystemSession(user.uid, trainingSystem.id, session.id);
            console.log('[Calendar] Full session fetched:', fullSession);
            if (fullSession) {
                console.log('[Calendar] Showing modal');
                this.showSessionDetailModal(fullSession, dateStr);
            } else {
                console.warn('[Calendar] Session not found in Firebase');
            }
        } catch (error) {
            console.error('[Calendar] Error fetching session details:', error);
        }
    }

    /**
     * Show session detail modal
     * @param {Object} session - Full session object from Firebase
     * @param {string} dateStr - Date string for display
     */
    showSessionDetailModal(session, dateStr) {
        console.log('[Calendar] showSessionDetailModal called:', { session, dateStr, modalExists: !!this.sessionDetailModal });
        
        // If modal reference is lost, try to find it again
        if (!this.sessionDetailModal) {
            console.log('[Calendar] Modal reference lost, trying to find it again...');
            this.sessionDetailModal = document.getElementById('session-detail-modal');
            if (!this.sessionDetailModal) {
                console.error('[Calendar] Modal element not found in DOM');
                return;
            }
        }
        
        if (!session) {
            console.warn('[Calendar] Cannot show modal - no session provided');
            return;
        }
        
        // Extract framework name
        const rawFramework = session.framework || session.workout || 'Workout';
        const framework = this.extractFrameworkName(rawFramework);
        const discipline = formatDisciplines(session.discipline) || '';
        
        // Format date
        const sessionDate = dateStr || session.date || this.getTodayLocalDateString();
        const sessionDateObj = this.parseLocalDateString(sessionDate);
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = sessionDateObj.toLocaleDateString('en-US', dateOptions);
        
        // Update modal header
        const titleEl = this.sessionDetailModal.querySelector('#session-detail-title');
        const subtitleEl = this.sessionDetailModal.querySelector('#session-detail-subtitle');
        const dateEl = this.sessionDetailModal.querySelector('#session-detail-date');
        
        if (titleEl) {
            titleEl.textContent = `${framework} Session`;
        }
        if (subtitleEl) {
            subtitleEl.textContent = discipline || '';
        }
        if (dateEl) {
            dateEl.textContent = formattedDate;
        }
        
        // Render phases
        this.renderSessionPhases(session.phases || {});
        
        // Show modal with animation
        this.sessionDetailModal.classList.remove('hidden');
        requestAnimationFrame(() => {
            const content = this.sessionDetailModal.querySelector('.session-detail-modal-content');
            if (content) {
                content.style.transform = 'scale(1)';
                content.style.opacity = '1';
            }
        });
    }

    /**
     * Hide session detail modal
     */
    hideSessionDetailModal() {
        if (!this.sessionDetailModal) return;
        
        const content = this.sessionDetailModal.querySelector('.session-detail-modal-content');
        if (content) {
            content.style.transform = 'scale(0.95)';
            content.style.opacity = '0';
        }
        
        setTimeout(() => {
            this.sessionDetailModal.classList.add('hidden');
        }, 300);
    }

    /**
     * Render session phases in modal
     * @param {Object} phases - Phases object with warmup, workout, cooldown arrays
     */
    renderSessionPhases(phases) {
        const phasesContainer = this.sessionDetailModal.querySelector('#session-detail-phases');
        if (!phasesContainer) return;
        
        const phaseConfig = {
            warmup: { name: 'Warm-up', icon: 'fa-fire', color: 'text-orange-400' },
            workout: { name: 'Workout', icon: 'fa-dumbbell', color: 'text-white' },
            cooldown: { name: 'Cool Down', icon: 'fa-wind', color: 'text-blue-400' }
        };
        
        phasesContainer.innerHTML = '';
        
        ['warmup', 'workout', 'cooldown'].forEach(phaseKey => {
            const phase = phases[phaseKey] || [];
            const config = phaseConfig[phaseKey];
            
            const phaseCard = document.createElement('div');
            phaseCard.className = 'glass rounded-xl border border-zinc-800 overflow-hidden';
            phaseCard.setAttribute('data-phase', phaseKey);
            
            const isExpanded = phaseKey === 'warmup'; // Expand first phase by default
            const uniqueId = `session-detail-phase-${phaseKey}`;
            const variationsId = `session-detail-variations-${phaseKey}`;
            
            phaseCard.innerHTML = `
                <div class="p-4 cursor-pointer" onclick="window.toggleSessionDetailPhase('${phaseKey}')">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center">
                            <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mr-3 border border-white/20">
                                <i class="fas ${config.icon} ${config.color}"></i>
                            </div>
                            <div>
                                <h4 class="font-semibold text-white">${config.name}</h4>
                                <p class="text-xs text-white/60">${phase.length} exercise${phase.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <i class="fas fa-chevron-${isExpanded ? 'up' : 'down'} text-white/60 transition-transform duration-300" id="session-detail-chevron-${phaseKey}"></i>
                        </div>
                    </div>
                </div>
                <div class="phase-variations px-4 pb-4 ${isExpanded ? '' : 'hidden'}" id="${variationsId}">
                    ${phase.length > 0 ? this.renderSessionVariationList(phase) : '<p class="text-sm text-white/60">No exercises in this phase</p>'}
                </div>
            `;
            
            phasesContainer.appendChild(phaseCard);
        });
        
        // Setup global toggle function for phases
        window.toggleSessionDetailPhase = (phaseKey) => {
            const variationsEl = document.getElementById(`session-detail-variations-${phaseKey}`);
            const chevronEl = document.getElementById(`session-detail-chevron-${phaseKey}`);
            
            if (variationsEl && chevronEl) {
                const isExpanded = !variationsEl.classList.contains('hidden');
                
                if (isExpanded) {
                    variationsEl.classList.add('hidden');
                    chevronEl.classList.remove('fa-chevron-up');
                    chevronEl.classList.add('fa-chevron-down');
                } else {
                    variationsEl.classList.remove('hidden');
                    chevronEl.classList.remove('fa-chevron-down');
                    chevronEl.classList.add('fa-chevron-up');
                }
            }
        };
    }

    /**
     * Render list of variations for a phase
     * @param {Array} variations - Array of variation objects
     * @returns {string} HTML string
     */
    renderSessionVariationList(variations) {
        return variations.map((variation, index) => {
            const exerciseName = variation.variationName || variation.exerciseName || 'Exercise';
            const baseExerciseName = variation.exerciseName || '';
            const targetMuscles = variation.target_muscles || {};
            const primaryMuscles = targetMuscles.primary || [];
            const secondaryMuscles = targetMuscles.secondary || [];
            
            return `
                <div class="flex items-start justify-between py-3 border-b border-white/10 last:border-0">
                    <div class="flex-1">
                        <p class="text-sm font-medium text-white">${exerciseName}</p>
                        ${baseExerciseName && baseExerciseName !== exerciseName ? `<p class="text-xs text-white/60 mt-1">${baseExerciseName}</p>` : ''}
                        ${primaryMuscles.length > 0 ? `
                            <div class="mt-2 flex flex-wrap gap-1">
                                ${primaryMuscles.map(muscle => `
                                    <span class="text-xs px-2 py-0.5 rounded bg-white/10 text-white/80">${muscle}</span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
}

