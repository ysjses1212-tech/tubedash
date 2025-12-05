// ===== 설정 (여기에 API 키 입력!) =====
const CONFIG = {
    // YouTube API 키 (여러 개 등록 가능)
    API_KEYS: [
        'AIzaSyCgbOY3gODsQCF0Ta5ie3v5tcLFlOIgzbE',
        'AIzaSyAfI1c6Lg5tAaZp82C8i5-hdFUwvIagFWk',
        
    ],
    // Supabase 설정
    SUPABASE_URL: 'https://rxuixdoqucgutqlxaqgr.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dWl4ZG9xdWNndXRxbHhhcWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzM4OTUsImV4cCI6MjA4MDEwOTg5NX0.ADR6Ppx_A0TUhgSnlkhKJ9_Nwm6RsfVMQmUiKNriAyE',
    // 할당량 설정
    DAILY_QUOTA_LIMIT: 10000,
    AUTO_SWITCH_THRESHOLD: 0.8  // 80%에서 자동 전환
};

// ===== 유틸리티 함수 =====
const formatNumber = (num) => {
    if (!num && num !== 0) return '-';
    try {
        return new Intl.NumberFormat('ko-KR', { notation: "compact", maximumFractionDigits: 1 }).format(num);
    } catch(e) {
        return num;
    }
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
};

const parseDuration = (duration) => {
    if (!duration) return '00:00';
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '00:00';
    const h = (match[1] || '').replace('H', '');
    const m = (match[2] || '').replace('M', '');
    const s = (match[3] || '').replace('S', '');
    return (h ? h + ':' : '') + m.padStart(2,'0') + ':' + s.padStart(2,'0');
};

const getDurationSeconds = (durationStr) => {
    if (!durationStr) return 0;
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
};

const extractChannelId = (input) => {
    if (!input) return null;
    input = input.trim();
    if (/^UC[\w-]{22}$/.test(input)) return input;
    const channelMatch = input.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
    if (channelMatch) return channelMatch[1];
    const handleMatch = input.match(/youtube\.com\/@([\w.-]+)/);
    if (handleMatch) return '@' + handleMatch[1];
    if (input.startsWith('@')) return input;
    if (/^[\w.-]+$/.test(input) && input.length > 2) return '@' + input;
    return null;
};

const extractVideoId = (input) => {
    if (!input) return null;
    input = input.trim();
    if (/^[\w-]{11}$/.test(input)) return input;
    const watchMatch = input.match(/youtube\.com\/watch\?v=([\w-]{11})/);
    if (watchMatch) return watchMatch[1];
    const shortMatch = input.match(/youtu\.be\/([\w-]{11})/);
    if (shortMatch) return shortMatch[1];
    const shortsMatch = input.match(/youtube\.com\/shorts\/([\w-]{11})/);
    if (shortsMatch) return shortsMatch[1];
    return null;
};

// ===== API 키 관리 =====
const getKeyQuotas = () => {
    const saved = localStorage.getItem('tubeDashKeyQuotas');
    if (saved) {
        const data = JSON.parse(saved);
        const today = new Date().toDateString();
        if (data.date !== today) {
            // 날짜 바뀌면 리셋
            return { 
                date: today, 
                currentIndex: 0,
                keys: CONFIG.API_KEYS.map(() => ({ used: 0 }))
            };
        }
        return data;
    }
    return { 
        date: new Date().toDateString(), 
        currentIndex: 0,
        keys: CONFIG.API_KEYS.map(() => ({ used: 0 }))
    };
};

const saveKeyQuotas = (data) => {
    localStorage.setItem('tubeDashKeyQuotas', JSON.stringify(data));
};

// 전역으로 내보내기
window.CONFIG = CONFIG;
window.formatNumber = formatNumber;
window.formatDate = formatDate;
window.parseDuration = parseDuration;
window.getDurationSeconds = getDurationSeconds;
window.extractChannelId = extractChannelId;
window.extractVideoId = extractVideoId;
window.getKeyQuotas = getKeyQuotas;

window.saveKeyQuotas = saveKeyQuotas;

