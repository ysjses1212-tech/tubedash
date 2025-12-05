from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import parse_qs, urlparse

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        headers = {
            'Content-type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        }
        
        try:
            query = parse_qs(urlparse(self.path).query)
            video_id = query.get('video_id', [None])[0]
            
            if not video_id:
                self.send_response(400)
                for key, value in headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'video_id가 필요합니다'
                }, ensure_ascii=False).encode('utf-8'))
                return
            
            # 최신 버전 방식으로 자막 가져오기
            from youtube_transcript_api import YouTubeTranscriptApi
            
            transcript = None
            used_language = None
            
            # 방법 1: 직접 가져오기 시도
            try:
                transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['ko', 'en'])
                used_language = 'ko/en'
            except Exception as e1:
                # 방법 2: 언어 지정 없이 시도
                try:
                    transcript = YouTubeTranscriptApi.get_transcript(video_id)
                    used_language = 'auto'
                except Exception as e2:
                    self.send_response(404)
                    for key, value in headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'error': f'자막을 가져올 수 없습니다',
                        'detail': str(e2),
                        'video_id': video_id
                    }, ensure_ascii=False).encode('utf-8'))
                    return
            
            # 자막 텍스트 합치기
            full_text = ' '.join([item['text'] for item in transcript])
            
            self.send_response(200)
            for key, value in headers.items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'video_id': video_id,
                'language': used_language,
                'transcript': full_text,
                'segments': len(transcript)
            }, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': f'서버 오류: {str(e)}'
            }, ensure_ascii=False).encode('utf-8'))
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
