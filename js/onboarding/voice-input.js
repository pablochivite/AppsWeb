// Voice Input Manager for onboarding questions
export class VoiceInputManager {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.onResultCallback = null;
        this.init();
    }

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported in this browser');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUIState('listening');
        };

        this.recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            
            this.updateTranscription(transcript);
            
            if (event.results[event.results.length - 1].isFinal) {
                this.handleFinalResult(transcript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.stopListening();
            this.updateUIState('error');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this.updateUIState) {
                this.updateUIState('idle');
            }
        };
    }

    startListening(questionType, onResult) {
        if (!this.recognition) {
            alert('Speech recognition is not supported in your browser');
            return;
        }

        this.onResultCallback = onResult;
        this.questionType = questionType;
        this.recognition.start();
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    updateTranscription(text) {
        // Find transcription in currently visible question
        const visibleQuestion = document.querySelector('[id^="onboarding-question-"]:not(.hidden)');
        if (visibleQuestion) {
            const transcriptionEl = visibleQuestion.querySelector('.voice-transcription');
            if (transcriptionEl) {
                transcriptionEl.textContent = text;
                transcriptionEl.classList.remove('hidden');
            }
        }
    }

    updateUIState(state) {
        const micButton = document.querySelector('.voice-mic-button');
        if (!micButton) return;

        micButton.classList.remove('voice-listening', 'voice-processing', 'voice-success', 'voice-error');
        
        switch(state) {
            case 'listening':
                micButton.classList.add('voice-listening');
                break;
            case 'processing':
                micButton.classList.add('voice-processing');
                break;
            case 'success':
                micButton.classList.add('voice-success');
                break;
            case 'error':
                micButton.classList.add('voice-error');
                break;
        }
    }

    handleFinalResult(transcript) {
        this.updateUIState('processing');
        const parsed = this.parseAnswer(transcript.toLowerCase(), this.questionType);
        
        if (parsed) {
            setTimeout(() => {
                this.updateUIState('success');
                if (this.onResultCallback) {
                    this.onResultCallback(parsed);
                }
                setTimeout(() => {
                    const visibleQuestion = document.querySelector('[id^="onboarding-question-"]:not(.hidden)');
                    if (visibleQuestion) {
                        const transcriptionEl = visibleQuestion.querySelector('.voice-transcription');
                        if (transcriptionEl) {
                            transcriptionEl.classList.add('hidden');
                        }
                    }
                    this.updateUIState('idle');
                }, 1000);
            }, 500);
        } else {
            this.updateUIState('error');
            setTimeout(() => {
                this.updateUIState('idle');
            }, 2000);
        }
    }

    parseAnswer(transcript, questionType) {
        switch(questionType) {
            case 'sedentary':
                // Parse hour intervals: 0-2, 2-4, 4-6, 6-8, 8+
                const lowerTranscript = transcript.toLowerCase();
                
                // Check for explicit hour ranges
                if (lowerTranscript.includes('0 to 2') || lowerTranscript.includes('zero to two') || 
                    (lowerTranscript.includes('0') && lowerTranscript.includes('2') && !lowerTranscript.includes('4'))) {
                    return '0-2';
                }
                if (lowerTranscript.includes('2 to 4') || lowerTranscript.includes('two to four')) {
                    return '2-4';
                }
                if (lowerTranscript.includes('4 to 6') || lowerTranscript.includes('four to six')) {
                    return '4-6';
                }
                if (lowerTranscript.includes('6 to 8') || lowerTranscript.includes('six to eight')) {
                    return '6-8';
                }
                if (lowerTranscript.includes('8') || lowerTranscript.includes('eight') || lowerTranscript.includes('more')) {
                    return '8+';
                }
                
                // Check for numbers and map to closest interval
                const numbers = transcript.match(/\d+/);
                if (numbers) {
                    const num = parseInt(numbers[0]);
                    if (num <= 2) return '0-2';
                    if (num <= 4) return '2-4';
                    if (num <= 6) return '4-6';
                    if (num <= 8) return '6-8';
                    return '8+';
                }
                
                return null;

            case 'discomforts':
                // Parse discomfort keywords
                const discomforts = [];
                const keywords = {
                    'back': 'Back',
                    'neck': 'Neck',
                    'joint': 'Joints',
                    'knee': 'Joints',
                    'shoulder': 'Joints',
                    'hip': 'Joints',
                    'wrist': 'Joints',
                    'ankle': 'Joints',
                    'none': 'None'
                };
                
                for (const [keyword, value] of Object.entries(keywords)) {
                    if (transcript.includes(keyword)) {
                        if (value === 'None') {
                            return ['None'];
                        }
                        if (!discomforts.includes(value)) {
                            discomforts.push(value);
                        }
                    }
                }
                
                return discomforts.length > 0 ? discomforts : null;

            case 'discipline':
                // Parse discipline names
                if (transcript.includes('pilates')) return 'Pilates';
                if (transcript.includes('animal flow') || transcript.includes('animalflow')) return 'Animal Flow';
                if (transcript.includes('weight') || transcript.includes('lifting') || transcript.includes('strength')) return 'Weights';
                if (transcript.includes('crossfit') || transcript.includes('cross fit')) return 'Crossfit';
                if (transcript.includes('calisthenics') || transcript.includes('calisthenic')) return 'Calisthenics';
                return null;

            default:
                return null;
        }
    }
}
