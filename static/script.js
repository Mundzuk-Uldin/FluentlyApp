// static/script.js

let mediaRecorder;
let audioChunks = [];

const recordButton = document.getElementById('recordButton');
const stopButton = document.getElementById('stopButton');
const playButton = document.getElementById('playButton');
const statusText = document.getElementById('status');
const transcribedTextElement = document.getElementById('transcribedText');
const correctedTextElement = document.getElementById('correctedText');
const voiceSelect = document.getElementById('voiceSelect');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorAlert = document.getElementById('errorAlert');
const speechRate = document.getElementById('speechRate');
const speechRateValue = document.getElementById('speechRateValue');

let voices = [];

// Initialize Bootstrap tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
});

// Populate the voice list
function populateVoiceList() {
    voices = speechSynthesis.getVoices();

    if (voices.length === 0) {
        setTimeout(populateVoiceList, 100);
        return;
    }

    voiceSelect.innerHTML = '';
    voices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${voice.name} (${voice.lang})`;
        voiceSelect.appendChild(option);
    });
}

// Initial population of voice list
populateVoiceList();

if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

// Update displayed speech rate when slider is moved
speechRate.addEventListener('input', () => {
    speechRateValue.innerText = speechRate.value;
});

// Function to update status text and color
function updateStatus(message, type) {
    statusText.innerText = message;
    if (type === 'success') {
        statusText.style.color = 'green';
    } else if (type === 'error') {
        statusText.style.color = 'red';
    } else {
        statusText.style.color = '#007bff'; // Bootstrap primary color
    }
}

// Event listener for Start Recording button
recordButton.addEventListener('click', async () => {
    errorAlert.style.display = 'none';
    audioChunks = [];
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        updateStatus('Microphone access denied.', 'error');
        return;
    }
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.start();
    updateStatus('Recording...', 'default');

    mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
    });

    recordButton.disabled = true;
    stopButton.disabled = false;
    playButton.disabled = true; // Disable Play Button during recording
});

// Event listener for Stop Recording button
stopButton.addEventListener('click', () => {
    mediaRecorder.stop();
    updateStatus('Processing...', 'default');
    loadingSpinner.style.display = 'block'; // Show spinner

    recordButton.disabled = false;
    stopButton.disabled = true;

    mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        let formData = new FormData();
        formData.append('audio_data', audioBlob, 'recording.webm');

        fetch('/process_audio', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            loadingSpinner.style.display = 'none'; // Hide spinner
            if (data.error) {
                updateStatus('An error occurred.', 'error');
                errorAlert.style.display = 'block';
                console.error('Error:', data.error);
                return;
            }
            updateStatus('Done', 'success');

            transcribedTextElement.innerText = data.transcribed_text;

            // Render the corrected text with Markdown support
            const markdownText = data.corrected_text;
            const rawHTML = marked.parse(markdownText);
            const sanitizedHTML = DOMPurify.sanitize(rawHTML);
            correctedTextElement.innerHTML = sanitizedHTML;

            playButton.disabled = false; // Enable Play Button
            playCorrectedText(); // Automatically play the corrected text
        })
        .catch(error => {
            loadingSpinner.style.display = 'none'; // Hide spinner
            updateStatus('An error occurred.', 'error');
            errorAlert.style.display = 'block';
            console.error('Error:', error);
        });
    });
});

// Function to play the corrected text
function playCorrectedText() {
    const correctedText = correctedTextElement.innerText || correctedTextElement.textContent;
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(correctedText);

        // Get the selected voice
        const selectedVoiceIndex = voiceSelect.selectedIndex;
        if (voices.length > 0 && selectedVoiceIndex >= 0) {
            utterance.voice = voices[selectedVoiceIndex];
        }

        // Get the selected speech rate
        const rate = parseFloat(speechRate.value);
        utterance.rate = rate;

        // Optional: Set other voice parameters
        utterance.pitch = 1;

        utterance.onerror = function(event) {
            console.error('SpeechSynthesisUtterance.onerror', event);
        };

        speechSynthesis.speak(utterance);
    } else {
        alert('Sorry, your browser does not support text to speech!');
    }
}

// Event listener for Play Corrected Text button
playButton.addEventListener('click', () => {
    playCorrectedText();
});
