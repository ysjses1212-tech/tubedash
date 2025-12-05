from http.server import BaseHTTPRequestHandler
import json
from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import parse_qs, urlparse

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # URL에서 video_id 파라미터 가져오기
            query = parse_qs(urlparse(self.path).query)
            video_id = query.get('video_id', [None])[0]
            
            if not video_id:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'video_id가 필요합니다'
                }).encode())
                return
            
            # 자막 가져오기 (한국어 우선, 없으면 영어, 없으면 자동생성)
            transcript = None
            try:
                transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['ko'])
            except:
                try:
                    transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
                except:
                    try:
                        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
                        transcript = transcript_list.find_generated_transcript(['ko', 'en']).fetch()
                    except:
                        pass
            
            if not transcript:
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': '자막을 찾을 수 없습니다'
                }).encode())
                return
            
            # 자막 텍스트 합치기
            full_text = ' '.join([item['text'] for item in transcript])
            
            # 성공 응답
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'video_id': video_id,
                'transcript': full_text,
                'segments': len(transcript)
            }).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': str(e)
            }).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
