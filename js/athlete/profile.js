// Profile Management for Athletes
import { getUserProfile, saveUserProfile } from '../core/storage.js';
import { getAuthUser } from '../core/auth-manager.js';
import { saveUserProfile as saveFirestoreProfile } from '../services/dbService.js';

/**
 * Initialize profile page
 */
export async function initProfile() {
    try {
        console.log('[Profile] Initializing profile page...');
        
        // Show loading state
        showLoadingState();
        
        // Load profile data from Firebase
        console.log('[Profile] Loading profile data...');
        const userProfile = await loadProfileData();
        console.log('[Profile] Profile data loaded:', userProfile);
        
        // Render all sections
        console.log('[Profile] Rendering sections...');
        renderPhysiologicalData(userProfile);
        renderPreferences(userProfile);
        renderBenchmarks(userProfile);
        
        // Load and display milestones
        await renderMilestones(userProfile);
        
        // Setup segmented switcher
        setupSegmentedSwitcher();
        
        // Setup save functionality
        setupSaveFunctionality();
        
        console.log('[Profile] Profile page initialized successfully');
    } catch (error) {
        console.error('[Profile] Error initializing profile:', error);
        console.error('[Profile] Error stack:', error.stack);
        showErrorState('Error loading profile data. Please refresh the page.');
    }
}

/**
 * Load profile data from Firebase
 * @returns {Promise<Object>} User profile object
 */
async function loadProfileData() {
    try {
        const userProfile = await getUserProfile();
        
        // If no profile data, return empty structure
        if (!userProfile) {
            return {
                baselineAssessment: {},
                preferredDisciplines: [],
                objectives: [],
                discomforts: []
            };
        }
        
        return userProfile;
    } catch (error) {
        console.error('Error loading profile data:', error);
        throw error;
    }
}

/**
 * Show loading state
 */
function showLoadingState() {
    // Sections are now controlled by the switcher, so we don't need to show/hide them here
    // The first section (physiological) will be active by default
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    // Loading state will be replaced by actual content
    // This function is kept for consistency but doesn't need to do anything
    // since render functions replace the innerHTML
}

/**
 * Show error state
 * @param {string} message - Error message
 */
function showErrorState(message) {
    console.error('[Profile] Error state:', message);
    // Show error in console, but don't replace form content
    // The form will still render with empty/default values
}

/**
 * Render physiological data section
 * @param {Object} userProfile - User profile object
 */
function renderPhysiologicalData(userProfile) {
    try {
        const physiological = userProfile?.baselineAssessment?.physiological || {};
        
        // Set values from Firebase data (safe access with fallbacks)
        const ageInput = document.getElementById('profile-age');
        const weightInput = document.getElementById('profile-weight');
        const heightInput = document.getElementById('profile-height');
        const bodyFatInput = document.getElementById('profile-bodyfat');
        const activityLevelSelect = document.getElementById('profile-activity-level');
        const injuryHistoryTextarea = document.getElementById('profile-injury-history');
        
        if (ageInput) ageInput.value = physiological.age || '';
        if (weightInput) weightInput.value = physiological.weight || '';
        if (heightInput) heightInput.value = physiological.height || '';
        if (bodyFatInput) bodyFatInput.value = physiological.bodyFatPercent || '';
        if (activityLevelSelect) {
            activityLevelSelect.value = physiological.activityLevel || '';
        }
        if (injuryHistoryTextarea) {
            injuryHistoryTextarea.value = physiological.injuryHistory || '';
        }
        
        console.log('[Profile] Physiological data rendered');
    } catch (error) {
        console.error('[Profile] Error rendering physiological data:', error);
    }
}

/**
 * Render preferences section
 * @param {Object} userProfile - User profile object
 */
function renderPreferences(userProfile) {
    try {
        const disciplines = userProfile?.preferredDisciplines || [];
        const objectives = userProfile?.objectives || [];
        const discomforts = userProfile?.discomforts || [];
        
        // Render disciplines as tags
        const disciplinesContainer = document.getElementById('profile-disciplines');
        if (disciplinesContainer) {
            if (disciplines.length > 0) {
                disciplinesContainer.innerHTML = disciplines.map(d => 
                    `<span class="px-3 py-1 rounded-full bg-white/10 text-white text-sm border border-white/20">${d}</span>`
                ).join('');
            } else {
                disciplinesContainer.innerHTML = '<span class="text-white/50 text-sm">No disciplines selected</span>';
            }
        }
        
        // Render objectives as tags
        const objectivesContainer = document.getElementById('profile-objectives');
        if (objectivesContainer) {
            if (objectives.length > 0) {
                objectivesContainer.innerHTML = objectives.map(o => 
                    `<span class="px-3 py-1 rounded-full bg-white/10 text-white text-sm border border-white/20">${o}</span>`
                ).join('');
            } else {
                objectivesContainer.innerHTML = '<span class="text-white/50 text-sm">No objectives selected</span>';
            }
        }
        
        // Render discomforts as tags
        const discomfortsContainer = document.getElementById('profile-discomforts');
        if (discomfortsContainer) {
            if (discomforts.length > 0) {
                discomfortsContainer.innerHTML = discomforts.map(d => 
                    `<span class="px-3 py-1 rounded-full bg-white/10 text-white text-sm border border-white/20">${d}</span>`
                ).join('');
            } else {
                discomfortsContainer.innerHTML = '<span class="text-white/50 text-sm">No discomforts selected</span>';
            }
        }
        
        
        console.log('[Profile] Preferences rendered');
    } catch (error) {
        console.error('[Profile] Error rendering preferences:', error);
    }
}

/**
 * Render benchmarks section
 * @param {Object} userProfile - User profile object
 */
function renderBenchmarks(userProfile) {
    try {
        const baseline = userProfile?.baselineAssessment || {};
        const mobility = baseline.mobility || {};
        const rotation = baseline.rotation || {};
        const flexibility = baseline.flexibility || {};
        const baselineMetrics = baseline.baselineMetrics || {};
    
    // Helper function to format score (1-5 scale)
    const formatScore = (score) => {
        if (score === null || score === undefined) return '-';
        return `${score}/5`;
    };
    
    // Helper function to format frequency
    const formatFrequency = (freq) => {
        if (freq === null || freq === undefined) return '-';
        const labels = { 1: 'Rarely', 2: 'Sometimes', 3: 'Often', 4: 'Very Often' };
        return labels[freq] || `${freq}/4`;
    };
    
    // Mobility benchmarks
    const overheadReachEl = document.getElementById('benchmark-overhead-reach');
    if (overheadReachEl) overheadReachEl.textContent = formatScore(mobility.overheadReach);
    
    const shoulderRotationEl = document.getElementById('benchmark-shoulder-rotation');
    if (shoulderRotationEl) shoulderRotationEl.textContent = formatScore(mobility.shoulderRotation);
    
    const hipFlexibilityEl = document.getElementById('benchmark-hip-flexibility');
    if (hipFlexibilityEl) hipFlexibilityEl.textContent = formatScore(mobility.hipFlexibility);
    
    const mobilityOverallEl = document.getElementById('benchmark-mobility-overall');
    if (mobilityOverallEl) mobilityOverallEl.textContent = mobility.overallScore ? `${mobility.overallScore.toFixed(1)}/5` : '-';
    
    // Rotation benchmarks
    const spinalRotationEl = document.getElementById('benchmark-spinal-rotation');
    if (spinalRotationEl) spinalRotationEl.textContent = formatScore(rotation.spinalRotation);
    
    const rotationFrequencyEl = document.getElementById('benchmark-rotation-frequency');
    if (rotationFrequencyEl) rotationFrequencyEl.textContent = formatFrequency(rotation.dailyRotationFrequency);
    
    const rotationOverallEl = document.getElementById('benchmark-rotation-overall');
    if (rotationOverallEl) rotationOverallEl.textContent = rotation.overallScore ? `${rotation.overallScore.toFixed(1)}/5` : '-';
    
    // Flexibility benchmarks
    const lowerBodyEl = document.getElementById('benchmark-lower-body');
    if (lowerBodyEl) lowerBodyEl.textContent = formatScore(flexibility.lowerBody);
    
    const upperBodyEl = document.getElementById('benchmark-upper-body');
    if (upperBodyEl) upperBodyEl.textContent = formatScore(flexibility.upperBody);
    
    const flexibilityOverallEl = document.getElementById('benchmark-flexibility-overall');
    if (flexibilityOverallEl) flexibilityOverallEl.textContent = flexibility.overallScore ? `${flexibility.overallScore.toFixed(1)}/5` : '-';
    
    // Baseline metrics (0-100 scale)
    const mobilityMetric = baselineMetrics.mobility || 0;
    const rotationMetric = baselineMetrics.rotation || 0;
    const flexibilityMetric = baselineMetrics.flexibility || 0;
    
    const mobilityMetricEl = document.getElementById('baseline-metric-mobility');
    if (mobilityMetricEl) mobilityMetricEl.textContent = mobilityMetric > 0 ? `${mobilityMetric}/100` : '-';
    
    const rotationMetricEl = document.getElementById('baseline-metric-rotation');
    if (rotationMetricEl) rotationMetricEl.textContent = rotationMetric > 0 ? `${rotationMetric}/100` : '-';
    
    const flexibilityMetricEl = document.getElementById('baseline-metric-flexibility');
    if (flexibilityMetricEl) flexibilityMetricEl.textContent = flexibilityMetric > 0 ? `${flexibilityMetric}/100` : '-';
    
    // Update progress bars
    const mobilityBar = document.getElementById('baseline-metric-mobility-bar');
    if (mobilityBar) mobilityBar.style.width = `${mobilityMetric}%`;
    
    const rotationBar = document.getElementById('baseline-metric-rotation-bar');
    if (rotationBar) rotationBar.style.width = `${rotationMetric}%`;
    
    const flexibilityBar = document.getElementById('baseline-metric-flexibility-bar');
    if (flexibilityBar) flexibilityBar.style.width = `${flexibilityMetric}%`;
    
        console.log('[Profile] Benchmarks rendered');
    } catch (error) {
        console.error('[Profile] Error rendering benchmarks:', error);
    }
}

/**
 * Setup segmented switcher for profile sections
 */
function setupSegmentedSwitcher() {
    const switcherOptions = document.querySelectorAll('.profile-switcher-option');
    const contentSections = document.querySelectorAll('.profile-content-section');
    
    switcherOptions.forEach(option => {
        option.addEventListener('click', () => {
            const targetSection = option.dataset.section;
            
            // Remove active class from all options
            switcherOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to clicked option
            option.classList.add('active');
            
            // Hide all content sections
            contentSections.forEach(section => section.classList.remove('active'));
            
            // Show target content section
            const targetContent = document.getElementById(`${targetSection}-content`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

/**
 * Setup save functionality for physiological data
 */
function setupSaveFunctionality() {
    const saveBtn = document.getElementById('save-physiological-btn');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            await saveProfileChanges();
        });
    }
}

/**
 * Save profile changes to Firebase
 */
async function saveProfileChanges() {
    try {
        const user = getAuthUser();
        if (!user) {
            alert('You must be logged in to save changes.');
            return;
        }
        
        // Get current profile
        const currentProfile = await getUserProfile();
        
        // Get form values
        const age = parseInt(document.getElementById('profile-age')?.value);
        const weight = parseFloat(document.getElementById('profile-weight')?.value);
        const height = parseFloat(document.getElementById('profile-height')?.value);
        const bodyFatPercent = parseFloat(document.getElementById('profile-bodyfat')?.value);
        const activityLevel = document.getElementById('profile-activity-level')?.value;
        const injuryHistory = document.getElementById('profile-injury-history')?.value.trim();
        
        // Validate inputs
        if (age && (age < 18 || age > 99)) {
            alert('Age must be between 18 and 99.');
            return;
        }
        
        if (weight && (weight < 30 || weight > 300)) {
            alert('Weight must be between 30 and 300 kg.');
            return;
        }
        
        if (height && (height < 100 || height > 250)) {
            alert('Height must be between 100 and 250 cm.');
            return;
        }
        
        if (bodyFatPercent && (bodyFatPercent < 0 || bodyFatPercent > 100)) {
            alert('Body fat percentage must be between 0 and 100.');
            return;
        }
        
        // Prepare physiological data - only include fields that have values
        const physiological = {};
        
        // Preserve existing values first
        if (currentProfile.baselineAssessment?.physiological) {
            Object.assign(physiological, currentProfile.baselineAssessment.physiological);
        }
        
        // Update with new values (only if provided)
        if (age) physiological.age = age;
        if (weight) physiological.weight = weight;
        if (height) physiological.height = height;
        if (bodyFatPercent !== undefined && bodyFatPercent !== '') {
            physiological.bodyFatPercent = bodyFatPercent;
        }
        if (activityLevel) physiological.activityLevel = activityLevel;
        if (injuryHistory) physiological.injuryHistory = injuryHistory;
        
        // Update baseline assessment
        const baselineAssessment = {
            ...(currentProfile.baselineAssessment || {}),
            physiological
        };
        
        // Prepare profile update
        const profileUpdate = {
            ...currentProfile,
            baselineAssessment
        };
        
        // Save to Firebase using dbService
        await saveFirestoreProfile(user.uid, profileUpdate);
        
        // Also update localStorage via storage.js for consistency
        await saveUserProfile(profileUpdate);
        
        // Show success message
        const saveBtn = document.getElementById('save-physiological-btn');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            saveBtn.classList.add('bg-green-500');
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.classList.remove('bg-green-500');
            }, 2000);
        }
        
        console.log('Profile updated successfully');
    } catch (error) {
        console.error('Error saving profile changes:', error);
        alert('Failed to save changes. Please try again.');
    }
}

/**
 * Render milestones in profile page
 * @param {Object} userProfile - User profile object
 */
async function renderMilestones(userProfile) {
    const milestonesContainer = document.getElementById('milestones-list');
    if (!milestonesContainer) {
        console.warn('Milestones container not found');
        return;
    }
    
    const milestones = userProfile.milestones || [];
    
    if (milestones.length === 0) {
        milestonesContainer.innerHTML = `
            <div class="glass rounded-lg p-4 border border-zinc-800 text-center">
                <p class="text-sm text-white/60 mb-3">No milestones yet. Create your first one!</p>
                <button id="add-milestone-btn" class="bg-white hover:bg-white/90 font-semibold px-4 py-2 rounded-lg transition-all duration-300" style="background-color: #F2ECE1; color: #323434;">
                    Add Milestone
                </button>
            </div>
        `;
    } else {
        milestonesContainer.innerHTML = milestones.map((milestone, index) => {
            const progress = calculateMilestoneProgress(milestone, userProfile);
            return `
                <div class="glass rounded-lg p-4 border border-zinc-800" data-milestone-index="${index}">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex-1">
                            <p class="font-medium text-white">${milestone.name}</p>
                            <p class="text-xs text-white/60">${getMilestoneTypeLabel(milestone.type)} • Target: ${milestone.target}${milestone.metric ? ' ' + milestone.metric : ''}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="p-2 rounded-lg hover:bg-white/10 transition-all edit-milestone-btn" data-index="${index}" title="Edit">
                                <i class="fas fa-edit" style="color: #323434;"></i>
                            </button>
                            <button class="p-2 rounded-lg hover:bg-white/10 transition-all delete-milestone-btn" data-index="${index}" title="Delete">
                                <i class="fas fa-trash" style="color: #323434;"></i>
                            </button>
                        </div>
                    </div>
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs text-white/60">Progress: ${progress.current} / ${milestone.target}</span>
                        <span class="text-xs text-white/60">${Math.round(progress.percentage)}%</span>
                    </div>
                    <div class="w-full bg-white/10 rounded-full h-2">
                        <div class="bg-white h-full rounded-full transition-all duration-500" style="width: ${progress.percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('') + `
            <button id="add-milestone-btn" class="w-full glass rounded-lg p-4 border border-zinc-800 hover:bg-white/5 transition-all duration-300 text-center" style="background-color: #F2ECE1;">
                <i class="fas fa-plus mr-2" style="color: #323434;"></i>
                <span class="font-medium" style="color: #323434;">Add New Milestone</span>
            </button>
        `;
    }
    
    // Attach event listeners
    attachMilestoneEventListeners(userProfile);
}

/**
 * Calculate progress for a milestone
 * @param {Object} milestone - Milestone object
 * @param {Object} userProfile - User profile object
 * @returns {Object} Progress object
 */
function calculateMilestoneProgress(milestone, userProfile) {
    const { type, target, metric } = milestone;
    
    let current = 0;
    let percentage = 0;
    
    switch (type) {
        case 'streak':
            current = userProfile.currentStreak || 0;
            percentage = Math.min(100, (current / target) * 100);
            break;
            
        case 'sessions':
            current = userProfile.totalSessions || 0;
            percentage = Math.min(100, (current / target) * 100);
            break;
            
        case 'metric':
            const baselineMetrics = userProfile.baselineAssessment?.baselineMetrics || {};
            current = baselineMetrics[metric] || 0;
            percentage = Math.min(100, (current / target) * 100);
            break;
            
        default:
            percentage = 0;
    }
    
    return { percentage, current };
}

/**
 * Get label for milestone type
 * @param {string} type - Milestone type
 * @returns {string} Label
 */
function getMilestoneTypeLabel(type) {
    const labels = {
        'streak': 'Day Streak',
        'sessions': 'Sessions',
        'metric': 'Metric Goal'
    };
    return labels[type] || type;
}

/**
 * Attach event listeners for milestone management
 * @param {Object} userProfile - User profile object
 */
function attachMilestoneEventListeners(userProfile) {
    // Add milestone button
    const addBtn = document.getElementById('add-milestone-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => showMilestoneModal());
    }
    
    // Edit milestone buttons
    document.querySelectorAll('.edit-milestone-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            showMilestoneModal(userProfile.milestones[index], index);
        });
    });
    
    // Delete milestone buttons
    document.querySelectorAll('.delete-milestone-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            if (confirm('Are you sure you want to delete this milestone?')) {
                await deleteMilestone(index);
            }
        });
    });
}

/**
 * Show milestone creation/editing modal
 * @param {Object} milestone - Milestone to edit (null for new)
 * @param {number} index - Index of milestone to edit (-1 for new)
 */
function showMilestoneModal(milestone = null, index = -1) {
    const isEdit = milestone !== null;
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="glass-strong rounded-2xl p-6 max-w-md w-full mx-4 border border-zinc-800">
            <h3 class="text-xl font-semibold text-white mb-4">${isEdit ? 'Edit' : 'Create'} Milestone</h3>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm text-white/70 mb-2">Milestone Name</label>
                    <input type="text" id="milestone-name" value="${milestone?.name || ''}" 
                           class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white" 
                           placeholder="e.g., 30 Day Streak">
                </div>
                
                <div>
                    <label class="block text-sm text-white/70 mb-2">Type</label>
                    <select id="milestone-type" class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white">
                        <option value="streak" ${milestone?.type === 'streak' ? 'selected' : ''}>Day Streak</option>
                        <option value="sessions" ${milestone?.type === 'sessions' ? 'selected' : ''}>Total Sessions</option>
                        <option value="metric" ${milestone?.type === 'metric' ? 'selected' : ''}>Metric Goal</option>
                    </select>
                </div>
                
                <div id="metric-selector" style="display: ${milestone?.type === 'metric' ? 'block' : 'none'};">
                    <label class="block text-sm text-white/70 mb-2">Metric</label>
                    <select id="milestone-metric" class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white">
                        <option value="mobility" ${milestone?.metric === 'mobility' ? 'selected' : ''}>Mobility</option>
                        <option value="rotation" ${milestone?.metric === 'rotation' ? 'selected' : ''}>Rotation</option>
                        <option value="flexibility" ${milestone?.metric === 'flexibility' ? 'selected' : ''}>Flexibility</option>
                    </select>
                </div>
                
                <div>
                    <label class="block text-sm text-white/70 mb-2">Target</label>
                    <input type="number" id="milestone-target" value="${milestone?.target || ''}" 
                           class="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white" 
                           placeholder="e.g., 30" min="1">
                </div>
            </div>
            
            <div class="flex gap-3 mt-6">
                <button id="cancel-milestone-btn" class="flex-1 px-4 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition-all">
                    Cancel
                </button>
                <button id="save-milestone-btn" class="flex-1 px-4 py-2 rounded-lg bg-white font-semibold hover:bg-white/90 transition-all" style="background-color: #F2ECE1; color: #323434;">
                    ${isEdit ? 'Update' : 'Create'}
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Show/hide metric selector based on type
    const typeSelect = modal.querySelector('#milestone-type');
    const metricSelector = modal.querySelector('#metric-selector');
    typeSelect.addEventListener('change', (e) => {
        metricSelector.style.display = e.target.value === 'metric' ? 'block' : 'none';
    });
    
    // Cancel button
    modal.querySelector('#cancel-milestone-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Save button
    modal.querySelector('#save-milestone-btn').addEventListener('click', async () => {
        const name = modal.querySelector('#milestone-name').value.trim();
        const type = modal.querySelector('#milestone-type').value;
        const target = parseInt(modal.querySelector('#milestone-target').value);
        const metric = type === 'metric' ? modal.querySelector('#milestone-metric').value : null;
        
        if (!name || !target || target < 1) {
            alert('Please fill in all fields with valid values');
            return;
        }
        
        const milestoneData = {
            name,
            type,
            target,
            ...(metric && { metric })
        };
        
        if (isEdit) {
            await updateMilestone(index, milestoneData);
        } else {
            await createMilestone(milestoneData);
        }
        
        document.body.removeChild(modal);
    });
}

/**
 * Create a new milestone
 * @param {Object} milestoneData - Milestone data
 */
async function createMilestone(milestoneData) {
    try {
        const userProfile = await getUserProfile();
        const milestones = userProfile.milestones || [];
        
        // Add ID to milestone
        milestoneData.id = `milestone-${Date.now()}`;
        milestones.push(milestoneData);
        
        userProfile.milestones = milestones;
        await saveUserProfile(userProfile);
        
        // Re-render milestones
        await renderMilestones(userProfile);
    } catch (error) {
        console.error('Error creating milestone:', error);
        alert('Failed to create milestone. Please try again.');
    }
}

/**
 * Update an existing milestone
 * @param {number} index - Index of milestone to update
 * @param {Object} milestoneData - Updated milestone data
 */
async function updateMilestone(index, milestoneData) {
    try {
        const userProfile = await getUserProfile();
        const milestones = userProfile.milestones || [];
        
        if (index >= 0 && index < milestones.length) {
            milestones[index] = { ...milestones[index], ...milestoneData };
            userProfile.milestones = milestones;
            await saveUserProfile(userProfile);
            
            // Re-render milestones
            await renderMilestones(userProfile);
        }
    } catch (error) {
        console.error('Error updating milestone:', error);
        alert('Failed to update milestone. Please try again.');
    }
}

/**
 * Delete a milestone
 * @param {number} index - Index of milestone to delete
 */
async function deleteMilestone(index) {
    try {
        const userProfile = await getUserProfile();
        const milestones = userProfile.milestones || [];
        
        if (index >= 0 && index < milestones.length) {
            milestones.splice(index, 1);
            userProfile.milestones = milestones;
            await saveUserProfile(userProfile);
            
            // Re-render milestones
            await renderMilestones(userProfile);
        }
    } catch (error) {
        console.error('Error deleting milestone:', error);
        alert('Failed to delete milestone. Please try again.');
    }
}

