from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import parse_qs, urlparse

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # CORS 헤더
        headers = {
            'Content-type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
        
        try:
            # URL에서 video_id 파라미터 가져오기
            query = parse_qs(urlparse(self.path).query)
            video_id = query.get('video_id', [None])[0]
            
            if not video_id:
                self.send_response(400)
                for key, value in headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'video_id가 필요합니다'
                }).encode())
                return
            
            # 라이브러리 임포트 테스트
            try:
                from youtube_transcript_api import YouTubeTranscriptApi
            except ImportError as e:
                self.send_response(500)
                for key, value in headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': f'라이브러리 임포트 실패: {str(e)}'
                }).encode())
                return
            
            # 사용 가능한 자막 목록 먼저 확인
            try:
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
                available = []
                for t in transcript_list:
                    available.append({
                        'language': t.language,
                        'language_code': t.language_code,
                        'is_generated': t.is_generated
                    })
            except Exception as e:
                self.send_response(404)
                for key, value in headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': f'자막 목록 조회 실패: {str(e)}',
                    'video_id': video_id
                }).encode())
                return
            
            # 자막 가져오기 시도
            transcript = None
            used_language = None
            
            # 1. 한국어 시도
            try:
                transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['ko'])
                used_language = 'ko'
            except:
                pass
            
            # 2. 영어 시도
            if not transcript:
                try:
                    transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
                    used_language = 'en'
                except:
                    pass
            
            # 3. 아무 자막이나 시도
            if not transcript:
                try:
                    for t in transcript_list:
                        transcript = t.fetch()
                        used_language = t.language_code
                        break
                except:
                    pass
            
            if not transcript:
                self.send_response(404)
                for key, value in headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': '자막을 가져올 수 없습니다',
                    'available_transcripts': available,
                    'video_id': video_id
                }).encode())
                return
            
            # 자막 텍스트 합치기
            full_text = ' '.join([item['text'] for item in transcript])
            
            # 성공 응답
            self.send_response(200)
            for key, value in headers.items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'video_id': video_id,
                'language': used_language,
                'transcript': full_text,
                'segments': len(transcript),
                'available_transcripts': available
            }).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': f'서버 오류: {str(e)}'
            }).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
