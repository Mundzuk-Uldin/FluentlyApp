import os
from flask import Flask, render_template, request, jsonify
from openai import OpenAI
import os
from dotenv import load_dotenv
import whisper
from werkzeug.utils import secure_filename
from pydub import AudioSegment

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
# Initialize the Flask app
app = Flask(__name__)

# Set your OpenAI API key

# Load the Whisper model once when the server starts
model = whisper.load_model("base")

@app.route('/process_audio', methods=['POST'])
def process_audio():
    # Check if an audio file is present in the request
    if 'audio_data' not in request.files:
        return jsonify({'error': 'No audio file provided.'}), 400

    audio_file = request.files['audio_data']
    filename = secure_filename(audio_file.filename)
    upload_folder = 'uploads'
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)
    audio_path = os.path.join(upload_folder, filename)
    audio_file.save(audio_path)

    try:
        # Convert WebM to WAV using pydub
        audio_segment = AudioSegment.from_file(audio_path, format="webm")
        wav_filename = f"{os.path.splitext(filename)[0]}.wav"
        wav_path = os.path.join(upload_folder, wav_filename)
        audio_segment.export(wav_path, format="wav")

        # Transcribe the audio using Whisper
        result = model.transcribe(wav_path)
        transcribed_text = result['text']

        # Correct the text using ChatGPT
        corrected_text = correct_text(transcribed_text)

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        # Clean up the uploaded files
        if os.path.exists(audio_path):
            os.remove(audio_path)
        if os.path.exists(wav_path):
            os.remove(wav_path)

    return jsonify({
        'transcribed_text': transcribed_text,
        'corrected_text': corrected_text
    })

def correct_text(text):
    prompt = f"Please correct the grammar of the following text and provide pronunciation suggestions for any mispronounced words:\n\n{text}"

    response = client.chat.completions.create(model="chatgpt-4o-latest",
    messages=[
        {
            "role": "system",
            "content": "You are an English language tutor who specializes in correcting grammar and pronunciation."
        },
        {"role": "user", "content": prompt}
    ],
    max_tokens=500,
    temperature=0.7)

    corrected_text = response.choices[0].message.content
    return corrected_text

# Additional routes and app setup
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
