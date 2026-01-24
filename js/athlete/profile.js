// Profile Management for Athletes
import { getUserProfile, saveUserProfile } from '../core/storage.js';
import { loadTemplate } from '../core/template-loader.js';
import { initAnalysisChat } from '../ui/analysis-chat.js';

/**
 * Initialize profile page
 */
export async function initProfile() {
    try {
        const userProfile = await getUserProfile();
        
        // Load and initialize analysis chat component
        await initAnalysisChatComponent();
        
        // Load and display milestones
        await renderMilestones(userProfile);
        
        // Load and display personal info (if needed)
        // TODO: Add personal info loading when those fields are implemented
    } catch (error) {
        console.error('Error initializing profile:', error);
    }
}

/**
 * Initialize analysis chat component
 */
async function initAnalysisChatComponent() {
    try {
        const container = document.getElementById('analysis-chat-container');
        if (!container) {
            console.warn('Analysis chat container not found');
            return;
        }

        // Load HTML template
        const html = await loadTemplate('html/components/analysis-chat.html');
        container.innerHTML = html;

        // Initialize the chat component
        initAnalysisChat();
    } catch (error) {
        console.error('Error initializing analysis chat:', error);
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
                <button id="add-milestone-btn" class="bg-white hover:bg-white/90 text-black font-semibold px-4 py-2 rounded-lg transition-all duration-300">
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
                                <i class="fas fa-edit text-white/60 hover:text-white"></i>
                            </button>
                            <button class="p-2 rounded-lg hover:bg-white/10 transition-all delete-milestone-btn" data-index="${index}" title="Delete">
                                <i class="fas fa-trash text-white/60 hover:text-red-400"></i>
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
            <button id="add-milestone-btn" class="w-full glass rounded-lg p-4 border border-zinc-800 hover:bg-white/5 transition-all duration-300 text-center">
                <i class="fas fa-plus text-white/60 mr-2"></i>
                <span class="text-white font-medium">Add New Milestone</span>
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
                <button id="save-milestone-btn" class="flex-1 px-4 py-2 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-all">
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

