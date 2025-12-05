from http.server import BaseHTTPRequestHandler
import json
import subprocess
import tempfile
import os
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
            
            video_url = f'https://www.youtube.com/watch?v={video_id}'
            
            # 임시 디렉토리에서 자막 다운로드
            with tempfile.TemporaryDirectory() as tmpdir:
                output_path = os.path.join(tmpdir, 'subtitle')
                
                # yt-dlp로 자막 다운로드 시도
                cmd = [
                    'yt-dlp',
                    '--skip-download',
                    '--write-auto-sub',
                    '--write-sub',
                    '--sub-lang', 'ko,en',
                    '--sub-format', 'vtt',
                    '--output', output_path,
                    video_url
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                
                # 자막 파일 찾기
                subtitle_text = None
                for lang in ['ko', 'en']:
                    for ext in ['.ko.vtt', '.en.vtt', f'.{lang}.vtt']:
                        subtitle_file = output_path + ext
                        if os.path.exists(subtitle_file):
                            with open(subtitle_file, 'r', encoding='utf-8') as f:
                                content = f.read()
                                # VTT 포맷에서 텍스트만 추출
                                lines = content.split('\n')
                                text_lines = []
                                for line in lines:
                                    line = line.strip()
                                    # 타임스탬프, WEBVTT 헤더, 빈 줄 제외
                                    if line and not line.startswith('WEBVTT') and '-->' not in line and not line.isdigit():
                                        # HTML 태그 제거
                                        import re
                                        clean_line = re.sub(r'<[^>]+>', '', line)
                                        if clean_line:
                                            text_lines.append(clean_line)
                                subtitle_text = ' '.join(text_lines)
                                break
                    if subtitle_text:
                        break
                
                if not subtitle_text:
                    self.send_response(404)
                    for key, value in headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'error': '자막을 찾을 수 없습니다',
                        'video_id': video_id,
                        'detail': result.stderr if result.stderr else 'No subtitle files found'
                    }, ensure_ascii=False).encode('utf-8'))
                    return
                
                self.send_response(200)
                for key, value in headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'video_id': video_id,
                    'transcript': subtitle_text,
                    'length': len(subtitle_text)
                }, ensure_ascii=False).encode('utf-8'))
            
        except subprocess.TimeoutExpired:
            self.send_response(504)
            for key, value in headers.items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': '시간 초과 - 영상이 너무 길거나 서버가 바쁩니다'
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
