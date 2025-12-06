const { useState, useEffect, useCallback } = React;
const { createClient } = supabase;

// ===== Icon 컴포넌트 =====
const Icon = ({ name, size = 16, className = "" }) => {
    const content = window.ICONS[name.toLowerCase()];
    if (!content) return <span style={{width: size, height: size, display:'inline-block'}} />;
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
};

// ===== 할당량 표시 컴포넌트 =====
const QuotaDisplay = ({ keyQuotas, currentKeyIndex }) => {
    const currentUsed = keyQuotas.keys[currentKeyIndex]?.used || 0;
    const percent = Math.min((currentUsed / CONFIG.DAILY_QUOTA_LIMIT) * 100, 100);
    
    const getBarColor = () => {
        if (percent < 50) return 'bg-emerald-500';
        if (percent < 80) return 'bg-yellow-500';
        return 'bg-red-500';
    };
    
    return (
        <div className="flex items-center gap-2 bg-bg-card border border-gray-700 rounded-lg px-3 py-2">
            <Icon name="zap" size={14} className="text-yellow-500"/>
            <div className="w-24">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full ${getBarColor()} transition-all duration-500`} style={{ width: `${percent}%` }} />
                </div>
            </div>
            <span className="text-xs font-mono text-gray-300">
                키{currentKeyIndex + 1}: {percent.toFixed(0)}%
            </span>
        </div>
    );
};

// ===== 예상 할당량 표시 =====
const EstimatedQuota = ({ channelCount, isVisible }) => {
    if (!isVisible || channelCount === 0) return null;
    const estimated = channelCount * 100 + Math.ceil(channelCount * 10 / 50);
    const isHigh = estimated > 1000;
    const isVeryHigh = estimated > 3000;
    
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            isVeryHigh ? 'bg-red-900/30 text-red-400 border border-red-800' : 
            isHigh ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800' : 
            'bg-gray-800 text-gray-400 border border-gray-700'
        }`}>
            <Icon name={isVeryHigh ? 'alert-triangle' : 'zap'} size={12}/>
            <span>예상: ~{estimated.toLocaleString()} ({channelCount}채널)</span>
        </div>
    );
};

// ===== 메인 앱 =====
const App = () => {
    // API 키 관리 상태
    const [keyQuotas, setKeyQuotas] = useState(() => getKeyQuotas());
    const [currentKeyIndex, setCurrentKeyIndex] = useState(() => getKeyQuotas().currentIndex || 0);
    
    // 기본 상태
    const [expandedKeyword, setExpandedKeyword] = useState(null);
    const [videoType, setVideoType] = useState(null); // 'keyword' or 'content'
    const [videoTypeMessage, setVideoTypeMessage] = useState(null);
    const [viewMode, setViewMode] = useState('card');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentTab, setCurrentTab] = useState('search');
    const [searchText, setSearchText] = useState('');
    const [searchVideos, setSearchVideos] = useState([]);
    const [nextPageToken, setNextPageToken] = useState(null);
    const [savedVideos, setSavedVideos] = useState([]);
    const [savedChannels, setSavedChannels] = useState([]);
    const [channelAnalysisVideos, setChannelAnalysisVideos] = useState([]);
    const [isChannelAnalysisActive, setIsChannelAnalysisActive] = useState(false);
    const [searchFilters, setSearchFilters] = useState({ type: 'all', date: 'all', subscriber: 'all', viewCount: 'all' });
    const [analysisFilters, setAnalysisFilters] = useState({ type: 'all', date: 'all', viewCount: 'all' });
    const [selectedCategory, setSelectedCategory] = useState('');
    const [savedVideoIds, setSavedVideoIds] = useState(new Set());
    const [savedChannelIds, setSavedChannelIds] = useState(new Set());
    
    // 설정 (CONFIG에서 기본값 가져옴)
    const [settings, setSettings] = useState({
        youtubeApiKey: CONFIG.API_KEYS[0] || '',
        supabaseUrl: CONFIG.SUPABASE_URL || '',
        supabaseKey: CONFIG.SUPABASE_KEY || ''
    });
    
    // 모달 상태
    const [isAddChannelOpen, setIsAddChannelOpen] = useState(false);
    const [channelInput, setChannelInput] = useState('');
    const [isAddingChannel, setIsAddingChannel] = useState(false);
    const [isAddVideoOpen, setIsAddVideoOpen] = useState(false);
    const [videoInput, setVideoInput] = useState('');
    const [isAddingVideo, setIsAddingVideo] = useState(false);
    
    // 카테고리 모달 상태
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [pendingChannelData, setPendingChannelData] = useState(null);
    const [selectedCategoryForSave, setSelectedCategoryForSave] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
    
    // 영상 필터 상태
    const [selectedVideoCategory, setSelectedVideoCategory] = useState('');
    const [videoTypeFilter, setVideoTypeFilter] = useState('all');
    
    // 영상 카테고리 모달 상태
    const [isVideoCategoryModalOpen, setIsVideoCategoryModalOpen] = useState(false);
    const [pendingVideoData, setPendingVideoData] = useState(null);
    // 키워드 추출 상태
const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
const [keywordTargetVideo, setKeywordTargetVideo] = useState(null);
const [keywordTranscriptInfo, setKeywordTranscriptInfo] = useState(null);  
const [manualScript, setManualScript] = useState('');  
const [useManualScript, setUseManualScript] = useState(false); 
const [serpApiUsage, setSerpApiUsage] = useState(() => {
    const saved = localStorage.getItem('serpApiUsage');
    return saved ? parseInt(saved, 10) : 0;
}); 
const [isAnalyzingTrends, setIsAnalyzingTrends] = useState(false); 
const [extractedKeywords, setExtractedKeywords] = useState([]);
const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);


    // 현재 API 키
    const currentApiKey = CONFIG.API_KEYS[currentKeyIndex] || settings.youtubeApiKey;

    // 토스트 표시
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // 할당량 추가 및 자동 키 전환
    const addQuota = (cost) => {
        setKeyQuotas(prev => {
            const newKeys = [...prev.keys];
            newKeys[currentKeyIndex] = { 
                used: (newKeys[currentKeyIndex]?.used || 0) + cost 
            };
            
            const newData = { ...prev, keys: newKeys };
            
            // 80% 초과 시 다음 키로 전환
            const currentUsed = newKeys[currentKeyIndex].used;
            if (currentUsed >= CONFIG.DAILY_QUOTA_LIMIT * CONFIG.AUTO_SWITCH_THRESHOLD) {
                const nextIndex = (currentKeyIndex + 1) % CONFIG.API_KEYS.length;
                const nextUsed = newKeys[nextIndex]?.used || 0;
                
                if (nextIndex !== currentKeyIndex && nextUsed < CONFIG.DAILY_QUOTA_LIMIT * CONFIG.AUTO_SWITCH_THRESHOLD) {
                    setCurrentKeyIndex(nextIndex);
                    newData.currentIndex = nextIndex;
                    showToast(`API 키 자동 전환! (키 ${nextIndex + 1}번)`, 'info');
                }
            }
            
            saveKeyQuotas(newData);
            return newData;
        });
    };

    // 할당량 리셋
    const resetQuota = () => {
        if (confirm('API 사용량을 초기화할까요?')) {
            const newData = {
                date: new Date().toDateString(),
                currentIndex: 0,
                keys: CONFIG.API_KEYS.map(() => ({ used: 0 }))
            };
            setKeyQuotas(newData);
            setCurrentKeyIndex(0);
            saveKeyQuotas(newData);
            showToast('사용량 초기화 완료');
        }
    };
    
    // 1. 제목에서 명사 추출 (가중치 3배)
    const titleNouns = extractNouns(title, true);
    
    // 2. 태그에서 명사 추출 (가중치 2배)
    const tagNouns = tags
        .filter(tag => !stopwords.includes(tag.toLowerCase()))
        .filter(tag => tag.length >= 2)
        .map(tag => ({ word: tag.toLowerCase(), source: 'tag', weight: 2 }));
    
    // 3. 해시태그 (가중치 2배)
    const hashtagNouns = hashtags
        .filter(tag => !stopwords.includes(tag))
        .filter(tag => tag.length >= 2)
        .map(tag => ({ word: tag, source: 'hashtag', weight: 2 }));
    
    // 4. 스크립트에서 명사 추출 (제목 키워드가 부족할 때만)
    let scriptNouns = [];
    if (titleNouns.length < 2 && transcriptText) {
        // 한글만 추출 (외국어 스크립트 제외)
        const koreanOnly = transcriptText.replace(/[^\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ');
        scriptNouns = extractNouns(koreanOnly, false);
    }
    
    // 모든 명사 합치기
    const allNouns = [...titleNouns, ...tagNouns, ...hashtagNouns, ...scriptNouns];
    
    // 단어별 점수 계산
    const wordScores = {};
    allNouns.forEach(({ word, source, weight }) => {
        if (!wordScores[word]) {
            wordScores[word] = { word, score: 0, sources: new Set() };
        }
        wordScores[word].score += weight;
        wordScores[word].sources.add(source);
    });
    
    // 점수순 정렬 후 상위 5개
    const topKeywords = Object.values(wordScores)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(({ word, score, sources }) => ({
            keyword: word,
            score,
            sources: Array.from(sources),
            type: 'keyword', // 나중에 터진 영상 수로 업데이트
            hitVideos: null, // 터진 영상 수
            totalViews: null // 총 조회수
        }));
    
    // 키워드가 0~1개면 콘텐츠형 영상
    const videoType = topKeywords.length <= 1 ? 'content' : 'keyword';
    
    return {
        keywords: topKeywords,
        videoType,
        message: videoType === 'content' 
            ? '키워드보다 콘텐츠/썸네일이 중요한 영상입니다' 
            : null
    };
};


// SerpAPI 사용량 저장
useEffect(() => {
    localStorage.setItem('serpApiUsage', serpApiUsage.toString());
}, [serpApiUsage]);
    
// Google Trends 분석 (상위 5개 키워드)
const analyzeKeywordTrends = async (keywords) => {
    setIsAnalyzingTrends(true);
    const top5 = keywords.slice(0, 5);
    const updatedKeywords = [...keywords];
    
    for (let i = 0; i < top5.length; i++) {
        const kw = top5[i];
        try {
            const response = await fetch(
                `${CONFIG.TRENDS_API}?keyword=${encodeURIComponent(kw.keyword)}`
            );
            const data = await response.json();
            
            if (data.success) {
                updatedKeywords[i].type = data.keyword_type;
                updatedKeywords[i].trendType = data.trend_type;
                setSerpApiUsage(prev => prev + 1);
            }
        } catch (error) {
            console.error(`Trends 분석 실패 (${kw.keyword}):`, error);
        }
    }
    
    setIsAnalyzingTrends(false);
    return updatedKeywords;
};

// 키워드 추출 버튼 클릭
const handleExtractKeywords = async (video, manualScriptText = null) => {
    setIsExtractingKeywords(true);
    setExtractedKeywords([]);
    setKeywordTranscriptInfo(null);
    
    try {
        let transcriptText = '';
        let isManual = false;
        
        // 스크립트 가져오기 (하이브리드: 로컬 우선 → Supadata 백업)
        if (manualScriptText && manualScriptText.trim()) {
            transcriptText = manualScriptText.trim();
            isManual = true;
        } else {
            let localSuccess = false;
            
            // 1차: 로컬 서버 시도 (무료, 무제한)
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                
                const localResponse = await fetch(`http://localhost:5000/api/transcript?video_id=${video.id}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                const localData = await localResponse.json();
                if (localData.success && localData.transcript) {
                    transcriptText = localData.transcript;
                    localSuccess = true;
                    console.log('✅ 로컬 서버에서 자막 가져옴 (무료)');
                }
            } catch (e) {
                console.log('로컬 서버 연결 안됨:', e.message);
            }
            
            // 2차: 로컬 실패시 Supadata API (월 100회 제한)
            if (!localSuccess) {
                try {
                    const response = await fetch(`${CONFIG.TRANSCRIPT_API}?video_id=${video.id}`);
                    const data = await response.json();
                    if (data.success && data.transcript) {
                        transcriptText = data.transcript;
                        console.log('✅ Supadata에서 자막 가져옴 (API 사용)');
                    }
                } catch (e2) {
                    console.log('스크립트 가져오기 실패:', e2);
                }
            }
        }
        
        // 스크립트 정보 저장
        setKeywordTranscriptInfo({
            hasTranscript: transcriptText.length > 0,
            length: transcriptText.length,
            isManual
        });
        
        console.log('📤 Gemini 요청:', { title: video.title, transcript: transcriptText.slice(0, 100) });
        
        // Gemini로 키워드 추출
        const keywordResponse = await fetch(CONFIG.KEYWORD_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: video.title || '',
                description: video.description || '',
                tags: video.tags || [],
                transcript: transcriptText
            })
        });
        
        const keywordResult = await keywordResponse.json();
        console.log('📥 Gemini 응답:', keywordResult);
        
        if (!keywordResult.success || !keywordResult.keywords) {
            throw new Error('키워드 추출 실패');
        }
        
        // 키워드 배열 생성
        let keywords = keywordResult.keywords.map(kw => ({
            keyword: kw,
            searchKeyword: kw.split('(')[0].trim(), // 괄호 번역 제거한 검색용 키워드
            sources: ['AI'],
            hitVideos: null,
            totalSearched: null,
            hitRate: null,
            hashtagCount: null,
            hitVideoList: [],
            relatedKeywords: [], // 연관 키워드
            type: 'unknown'
        }));
        
        setVideoType(keywordResult.videoType);
        setVideoTypeMessage(keywordResult.videoType === 'content' ? '키워드보다 콘텐츠/썸네일이 중요한 영상입니다' : null);
        
        // 키워드형 영상이면 YouTube 검색 + 연관 키워드
        if (keywordResult.videoType === 'keyword' && keywords.length > 0) {
            const searchPromises = keywords.map(async (kw) => {
                const searchTerm = kw.searchKeyword; // 괄호 제거된 키워드로 검색
                
                try {
                    // 1. 일반 검색 (상위 50개)
                    const searchResponse = await fetch(
                        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=video&maxResults=50&key=${CONFIG.API_KEYS[currentKeyIndex]}`
                    );
                    const searchData = await searchResponse.json();
                    
                    if (searchData.items && searchData.items.length > 0) {
                        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
                        
                        // 조회수 가져오기
                        const statsResponse = await fetch(
                            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${CONFIG.API_KEYS[currentKeyIndex]}`
                        );
                        const statsData = await statsResponse.json();
                        
                        // 숏폼(60초 이하) 100만+ / 롱폼(60초 초과) 50만+ 필터
                        const hitVideos = statsData.items?.filter(v => {
                            const viewCount = parseInt(v.statistics?.viewCount || 0);
                            const duration = v.contentDetails?.duration || '';
                            
                            const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                            let totalSeconds = 0;
                            if (durationMatch) {
                                const hours = parseInt(durationMatch[1] || 0);
                                const minutes = parseInt(durationMatch[2] || 0);
                                const seconds = parseInt(durationMatch[3] || 0);
                                totalSeconds = hours * 3600 + minutes * 60 + seconds;
                            }
                            
                            const isShort = totalSeconds <= 60;
                            const threshold = isShort ? 1000000 : 500000;
                            
                            return viewCount >= threshold;
                        }) || [];
                        
                        kw.hitVideos = hitVideos.length;
                        kw.totalSearched = searchData.items.length;
                        kw.hitRate = Math.round((hitVideos.length / searchData.items.length) * 100);
                        kw.type = kw.hitRate >= 50 ? 'hot' : kw.hitRate >= 20 ? 'potential' : 'weak';
                        
                        // 터진 영상 목록 저장 (상위 10개)
                        kw.hitVideoList = hitVideos.slice(0, 10).map(v => ({
                            id: v.id,
                            title: v.snippet?.title || '',
                            thumbnail: v.snippet?.thumbnails?.default?.url || '',
                            viewCount: parseInt(v.statistics?.viewCount || 0),
                            channelTitle: v.snippet?.channelTitle || ''
                        }));
                    }
                    
                    // 2. 해시태그 검색 (괄호 제거된 키워드로)
                    try {
                        const hashtagResponse = await fetch(
                            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent('#' + searchTerm)}&type=video&maxResults=1&key=${CONFIG.API_KEYS[currentKeyIndex]}`
                        );
                        const hashtagData = await hashtagResponse.json();
                        kw.hashtagCount = hashtagData.pageInfo?.totalResults || 0;
                    } catch (e) {
                        kw.hashtagCount = null;
                    }
                    
                    // 3. 연관 키워드 가져오기
                    try {
                        const relatedResponse = await fetch(
                            `https://transcript-api-dtm5.onrender.com/api/related-keywords?keyword=${encodeURIComponent(searchTerm)}`
                        );
                        const relatedData = await relatedResponse.json();
                        if (relatedData.success && relatedData.related) {
                            kw.relatedKeywords = relatedData.related;
                        }
                    } catch (e) {
                        console.log('연관 키워드 가져오기 실패:', e);
                        kw.relatedKeywords = [];
                    }
                    
                } catch (error) {
                    console.error(`키워드 검색 실패 (${searchTerm}):`, error);
                }
                return kw;
            });
            
            await Promise.all(searchPromises);
        }
        
        setExtractedKeywords(keywords);
        
    } catch (error) {
        console.error('키워드 추출 실패:', error);
        alert('키워드 추출에 실패했습니다: ' + error.message);
    } finally {
        setIsExtractingKeywords(false);
    }
};



// 키워드 저장
const saveKeywordsToSupabase = async () => {
    if (!settings.supabaseUrl || extractedKeywords.length === 0) return;
    
    const client = createClient(settings.supabaseUrl, settings.supabaseKey);
    
    try {
        for (const kw of extractedKeywords) {
            // 1. 키워드 저장 (이미 있으면 무시)
            const { data: existingKeyword } = await client
                .from('keywords')
                .select('id')
                .eq('keyword', kw.keyword)
                .single();
            
            let keywordId;
            
            if (existingKeyword) {
                keywordId = existingKeyword.id;
            } else {
                const { data: newKeyword, error } = await client
                    .from('keywords')
                    .insert([{
                        keyword: kw.keyword,
                        keyword_type: kw.type,
                        trend_type: kw.trendType
                    }])
                    .select('id')
                    .single();
                
                if (error) throw error;
                keywordId = newKeyword.id;
            }
            
            // 2. 영상-키워드 연결 저장
            await client
                .from('video_keywords')
                .upsert([{
                    video_id: keywordTargetVideo.id,
                    keyword_id: keywordId,
                    frequency: kw.frequency,
                    source: kw.source
                }], { onConflict: 'video_id,keyword_id' });
        }
        
        showToast(`${extractedKeywords.length}개 키워드 저장 완료!`);
        setIsKeywordModalOpen(false);
        
    } catch (err) {
        console.error('키워드 저장 실패:', err);
        showToast('키워드 저장 실패: ' + err.message, 'error');
    }
};

// 키워드 타입 수동 변경
const updateKeywordType = (index, newType) => {
    setExtractedKeywords(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], type: newType };
        return updated;
    });
};
    // 수동 키 전환
    const switchApiKey = (index) => {
        if (index >= 0 && index < CONFIG.API_KEYS.length) {
            setCurrentKeyIndex(index);
            setKeyQuotas(prev => {
                const newData = { ...prev, currentIndex: index };
                saveKeyQuotas(newData);
                return newData;
            });
            showToast(`API 키 ${index + 1}번으로 전환`);
        }
    };

    // 초기 로드
    useEffect(() => {
        const loaded = getKeyQuotas();
        setKeyQuotas(loaded);
        setCurrentKeyIndex(loaded.currentIndex || 0);
        
        // Supabase 데이터 로드
        if (settings.supabaseUrl && settings.supabaseKey) {
            fetchSavedIDs(settings.supabaseUrl, settings.supabaseKey);
        }
    }, []);

    // 저장된 ID 불러오기
    const fetchSavedIDs = async (url, key) => {
        try {
            const client = createClient(url, key);
            const { data: vData } = await client.from('video_assets').select('video_id');
            if (vData) setSavedVideoIds(new Set(vData.map(v => v.video_id)));
            const { data: cData } = await client.from('channel_assets').select('channel_id');
            if (cData) setSavedChannelIds(new Set(cData.map(c => c.channel_id)));
        } catch (err) {
            console.error('데이터 로드 실패:', err);
        }
    };

    // 기존 카테고리 목록
    const getExistingCategories = () => {
        const categories = savedChannels.map(c => c.category).filter(c => c);
        return [...new Set(categories)];
    };

    const getExistingVideoCategories = () => {
        const categories = savedVideos.map(v => v.category).filter(c => c);
        return [...new Set(categories)];
    };

    // 카테고리 모달 열기
    const openCategoryModal = (channelData) => {
        setPendingChannelData(channelData);
        setSelectedCategoryForSave(channelData.category || '');
        setNewCategoryName('');
        setIsCreatingNewCategory(false);
        setIsCategoryModalOpen(true);
    };

    // 채널 저장 확정
    const confirmSaveChannel = async () => {
        if (!pendingChannelData) return;
        let finalCategory = isCreatingNewCategory ? newCategoryName.trim() : selectedCategoryForSave;
        if (!finalCategory) { showToast('카테고리를 선택해주세요.', 'error'); return; }

        const client = createClient(settings.supabaseUrl, settings.supabaseKey);
        try {
            if (pendingChannelData.isEdit) {
                const { error } = await client.from('channel_assets').update({ category: finalCategory }).eq('id', pendingChannelData.dbId);
                if (error) throw error;
                showToast(`[${finalCategory}] 카테고리 변경!`);
                fetchSavedAssets('channel');
            } else {
                const { error } = await client.from('channel_assets').insert([{
                    channel_id: pendingChannelData.channelId,
                    channel_title: pendingChannelData.channelTitle,
                    thumbnail: pendingChannelData.thumbnail,
                    subscriber_count: pendingChannelData.subscriberCount,
                    category: finalCategory
                }]);
                if (error) throw error;
                setSavedChannelIds(prev => new Set(prev).add(pendingChannelData.channelId));
                showToast(`[${finalCategory}] 채널 저장 완료!`);
                if (currentTab === 'saved_channel') fetchSavedAssets('channel');
            }
            setIsCategoryModalOpen(false);
            setPendingChannelData(null);
        } catch (err) {
            showToast('오류: ' + err.message, 'error');
        }
    };

    // 채널 카테고리 변경
    const handleChangeCategory = (channel) => {
        setPendingChannelData({ ...channel, isEdit: true });
        setSelectedCategoryForSave(channel.category || '');
        setNewCategoryName('');
        setIsCreatingNewCategory(false);
        setIsCategoryModalOpen(true);
    };

    // 영상 카테고리 모달 열기
    const openVideoCategoryModal = (video, isEdit = false) => {
        setPendingVideoData({ ...video, isEdit });
        setSelectedCategoryForSave(video.category || '');
        setNewCategoryName('');
        setIsCreatingNewCategory(false);
        setIsVideoCategoryModalOpen(true);
    };

    // 영상 저장 확정
    const confirmSaveVideoWithCategory = async () => {
        if (!pendingVideoData) return;
        let finalCategory = isCreatingNewCategory ? newCategoryName.trim() : selectedCategoryForSave;
        if (!finalCategory) { showToast('카테고리를 선택해주세요.', 'error'); return; }

        const client = createClient(settings.supabaseUrl, settings.supabaseKey);
        try {
            if (pendingVideoData.isEdit) {
                const { error } = await client.from('video_assets').update({ category: finalCategory }).eq('id', pendingVideoData.dbId);
                if (error) throw error;
                showToast(`[${finalCategory}] 카테고리 변경!`);
            } else {
                const { error } = await client.from('video_assets').insert([{
                    video_id: pendingVideoData.id,
                    title: pendingVideoData.title,
                    description: pendingVideoData.description,
                    thumbnail: pendingVideoData.thumbnail,
                    channel_title: pendingVideoData.channelTitle,
                    channel_id: pendingVideoData.channelId,
                    view_count: pendingVideoData.viewCount,
                    like_count: pendingVideoData.likeCount,
                    comment_count: pendingVideoData.commentCount,
                    subscriber_count: pendingVideoData.subscriberCount,
                    published_at: pendingVideoData.publishedAt,
                    duration: pendingVideoData.formattedDuration,
                    tags: pendingVideoData.tags || [],
                    category: finalCategory
                }]);
                if (error) throw error;
                setSavedVideoIds(prev => new Set(prev).add(pendingVideoData.id));
                showToast(`[${finalCategory}] 영상 저장 완료!`);
            }
            setIsVideoCategoryModalOpen(false);
            setPendingVideoData(null);
            if (currentTab === 'saved_video') fetchSavedAssets('video');
        } catch (err) {
            showToast('오류: ' + err.message, 'error');
        }
    };

    // 영상 카테고리 변경
    const handleChangeVideoCategory = (video) => {
        openVideoCategoryModal(video, true);
    };

    // 영상 저장
    const handleSaveVideo = async (video) => {
        if (!settings.supabaseUrl) return alert("설정을 먼저 해주세요");
        if (savedVideoIds.has(video.id)) return showToast('이미 저장됨', 'error');
        openVideoCategoryModal(video, false);
    };

    // 채널 저장
    const handleSaveChannel = async (video) => {
        if (!settings.supabaseUrl) return alert("설정을 먼저 해주세요");
        if (savedChannelIds.has(video.channelId)) return showToast('이미 저장됨', 'error');
        openCategoryModal({
            channelId: video.channelId,
            channelTitle: video.channelTitle,
            thumbnail: video.channelThumbnail,
            subscriberCount: video.subscriberCount
        });
    };

    // 채널 URL로 추가
    const handleAddChannelByUrl = async () => {
        if (!channelInput.trim()) { showToast('URL 또는 ID를 입력하세요.', 'error'); return; }
        if (!currentApiKey) { showToast('API 키를 설정해주세요.', 'error'); return; }

        setIsAddingChannel(true);
        const baseUrl = 'https://www.googleapis.com/youtube/v3';
        
        try {
            const extracted = extractChannelId(channelInput);
            if (!extracted) { showToast('올바른 URL/ID가 아닙니다.', 'error'); return; }

            let channelId = extracted;

            if (extracted.startsWith('@')) {
                const handleName = extracted.substring(1);
                const searchUrl = `${baseUrl}/search?part=snippet&type=channel&q=${encodeURIComponent(handleName)}&maxResults=5&key=${currentApiKey}`;
                const searchRes = await fetch(searchUrl);
                const searchData = await searchRes.json();
                addQuota(100);
                
                if (searchData.error) throw new Error(searchData.error.message);
                
                const matchedChannel = searchData.items?.find(item => {
                    const customUrl = item.snippet.customUrl?.toLowerCase();
                    return customUrl === handleName.toLowerCase() || customUrl === '@' + handleName.toLowerCase();
                }) || searchData.items?.[0];
                
                if (!matchedChannel) { showToast('채널을 찾을 수 없습니다.', 'error'); return; }
                channelId = matchedChannel.snippet.channelId;
            }

            if (savedChannelIds.has(channelId)) { showToast('이미 저장됨', 'error'); return; }

            const channelUrl = `${baseUrl}/channels?part=snippet,statistics&id=${channelId}&key=${currentApiKey}`;
            const channelRes = await fetch(channelUrl);
            const channelData = await channelRes.json();
            addQuota(1);

            if (channelData.error) throw new Error(channelData.error.message);
            if (!channelData.items?.length) { showToast('채널을 찾을 수 없습니다.', 'error'); return; }

            const channel = channelData.items[0];
            setIsAddChannelOpen(false);
            setChannelInput('');
            
            openCategoryModal({
                channelId: channel.id,
                channelTitle: channel.snippet.title,
                thumbnail: channel.snippet.thumbnails.default?.url,
                subscriberCount: parseInt(channel.statistics.subscriberCount || 0)
            });
        } catch (err) {
            showToast('오류: ' + err.message, 'error');
        } finally {
            setIsAddingChannel(false);
        }
    };

    // 영상 URL로 추가
    const handleAddVideoByUrl = async () => {
        if (!videoInput.trim()) { showToast('URL 또는 ID를 입력하세요.', 'error'); return; }
        if (!currentApiKey) { showToast('API 키를 설정해주세요.', 'error'); return; }

        setIsAddingVideo(true);
        const baseUrl = 'https://www.googleapis.com/youtube/v3';
        
        try {
            const videoId = extractVideoId(videoInput);
            if (!videoId) { showToast('올바른 URL/ID가 아닙니다.', 'error'); return; }
            if (savedVideoIds.has(videoId)) { showToast('이미 저장됨', 'error'); return; }

            const videoUrl = `${baseUrl}/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${currentApiKey}`;
            const videoRes = await fetch(videoUrl);
            const videoData = await videoRes.json();
            addQuota(1);

            if (videoData.error) throw new Error(videoData.error.message);
            if (!videoData.items?.length) { showToast('영상을 찾을 수 없습니다.', 'error'); return; }

            const item = videoData.items[0];
            
            const channelUrl = `${baseUrl}/channels?part=statistics&id=${item.snippet.channelId}&key=${currentApiKey}`;
            const channelRes = await fetch(channelUrl);
            const channelData = await channelRes.json();
            addQuota(1);

            const subscriberCount = parseInt(channelData.items?.[0]?.statistics?.subscriberCount || 0);
            
            setIsAddVideoOpen(false);
            setVideoInput('');
            
            openVideoCategoryModal({
                id: videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails.medium?.url,
                channelTitle: item.snippet.channelTitle,
                channelId: item.snippet.channelId,
                viewCount: parseInt(item.statistics.viewCount || 0),
                likeCount: parseInt(item.statistics.likeCount || 0),
                commentCount: parseInt(item.statistics.commentCount || 0),
                subscriberCount,
                publishedAt: item.snippet.publishedAt,
                formattedDuration: parseDuration(item.contentDetails.duration),
                tags: item.snippet.tags || []
            }, false);
        } catch (err) {
            showToast('오류: ' + err.message, 'error');
        } finally {
            setIsAddingVideo(false);
        }
    };

    // 삭제
    const handleDelete = async (id, table, realId) => {
        if (!confirm("삭제할까요?")) return;
        const client = createClient(settings.supabaseUrl, settings.supabaseKey);
        
        try {
            const { error } = await client.from(table).delete().eq('id', id);
            if (error) throw error;
            showToast('삭제 완료');
            
            if (table === 'video_assets') {
                const newSet = new Set(savedVideoIds);
                newSet.delete(realId);
                setSavedVideoIds(newSet);
                if (currentTab === 'saved_video') fetchSavedAssets('video');
            } else {
                const newSet = new Set(savedChannelIds);
                newSet.delete(realId);
                setSavedChannelIds(newSet);
                if (currentTab === 'saved_channel') fetchSavedAssets('channel');
            }
        } catch (err) {
            showToast('삭제 실패', 'error');
        }
    };

    // 저장된 데이터 불러오기
    const fetchSavedAssets = async (target) => {
        if (!settings.supabaseUrl) return;
        setIsLoading(true);
        
        if (target === 'video') setCurrentTab('saved_video');
        else if (target === 'channel') { setCurrentTab('saved_channel'); setIsChannelAnalysisActive(false); }

        const client = createClient(settings.supabaseUrl, settings.supabaseKey);
        
        try {
            if (target === 'video' || !target) {
                const { data } = await client.from('video_assets').select('*').order('created_at', { ascending: false });
                setSavedVideos((data || []).map(item => ({
                    dbId: item.id,
                    id: item.video_id,
                    title: item.title,
                    description: item.description,
                    thumbnail: item.thumbnail,
                    channelTitle: item.channel_title,
                    channelId: item.channel_id,
                    viewCount: item.view_count,
                    likeCount: item.like_count,
                    commentCount: item.comment_count,
                    subscriberCount: item.subscriber_count,
                    publishedAt: item.published_at,
                    formattedDuration: item.duration,
                    tags: item.tags || [],
                    category: item.category || ''
                })));
            }
            if (target === 'channel' || !target) {
                const { data } = await client.from('channel_assets').select('*').order('created_at', { ascending: false });
                setSavedChannels((data || []).map(item => ({
                    dbId: item.id,
                    channelId: item.channel_id,
                    channelTitle: item.channel_title,
                    thumbnail: item.thumbnail,
                    subscriberCount: item.subscriber_count,
                    category: item.category
                })));
            }
        } catch (err) {
            console.error('데이터 로드 실패:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // 채널 분석
    const analyzeChannelVideos = async () => {
        const targetChannels = savedChannels.filter(c => selectedCategory === '' || c.category === selectedCategory);
        if (targetChannels.length === 0) return alert("분석할 채널이 없습니다.");

        const estimatedCost = targetChannels.length * 100 + Math.ceil(targetChannels.length * 10 / 50);
        if (estimatedCost > 2000 && !confirm(`약 ${estimatedCost.toLocaleString()} 쿼터가 소모됩니다. 계속할까요?`)) return;

        setIsLoading(true);
        setChannelAnalysisVideos([]);
        setIsChannelAnalysisActive(true);

        const baseUrl = 'https://www.googleapis.com/youtube/v3';
        let totalQuotaCost = 0;
        let allRawItems = [];

        try {
            let publishedAfter = '';
            if (analysisFilters.date !== 'all') {
                const now = new Date();
                if (analysisFilters.date === '1d') now.setDate(now.getDate() - 1);
                else if (analysisFilters.date === '3d') now.setDate(now.getDate() - 3);
                else if (analysisFilters.date === '1m') now.setMonth(now.getMonth() - 1);
                else if (analysisFilters.date === '6m') now.setMonth(now.getMonth() - 6);
                publishedAfter = `&publishedAfter=${now.toISOString()}`;
            }

            for (const channel of targetChannels) {
                let searchUrl = `${baseUrl}/search?part=snippet&channelId=${channel.channelId}&order=date&type=video&maxResults=10&key=${currentApiKey}`;
                if (publishedAfter) searchUrl += publishedAfter;
                
                try {
                    const res = await fetch(searchUrl);
                    if (!res.ok) continue;
                    const data = await res.json();
                    totalQuotaCost += 100;
                    if (data.items) allRawItems = [...allRawItems, ...data.items];
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (innerErr) {
                    console.error(innerErr);
                }
            }

            if (allRawItems.length === 0) {
                addQuota(totalQuotaCost);
                setIsLoading(false);
                return;
            }

            const videoIdsList = allRawItems.map(item => item.id.videoId);
            let allDetails = [];
            
            for (let i = 0; i < videoIdsList.length; i += 50) {
                const chunk = videoIdsList.slice(i, i + 50).join(',');
                const videosUrl = `${baseUrl}/videos?part=contentDetails,statistics,snippet,liveStreamingDetails&id=${chunk}&key=${currentApiKey}`;
                const res = await fetch(videosUrl);
                const data = await res.json();
                if (data.items) allDetails = [...allDetails, ...data.items];
                totalQuotaCost += 1;
            }

            const newVideos = allDetails.map(item => ({
                id: item.id,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails.medium?.url,
                publishedAt: item.snippet.publishedAt,
                channelTitle: item.snippet.channelTitle,
                channelId: item.snippet.channelId,
                viewCount: parseInt(item.statistics.viewCount || 0),
                likeCount: parseInt(item.statistics.likeCount || 0),
                commentCount: parseInt(item.statistics.commentCount || 0),
                subscriberCount: 0,
                duration: item.contentDetails.duration,
                formattedDuration: parseDuration(item.contentDetails.duration),
                tags: item.snippet.tags || [],
                liveBroadcastContent: item.snippet.liveBroadcastContent,
                isLiveContent: !!item.liveStreamingDetails
            })).filter(v => {
                if (v.liveBroadcastContent !== 'none' || v.isLiveContent) return false;
                
                const views = v.viewCount;
                if (analysisFilters.viewCount === 'u10k' && views > 10000) return false;
                if (analysisFilters.viewCount === 'o10k' && views < 10000) return false;
                if (analysisFilters.viewCount === 'o100k' && views < 100000) return false;
                if (analysisFilters.viewCount === 'o500k' && views < 500000) return false;
                if (analysisFilters.viewCount === 'o1m' && views < 1000000) return false;
                
                const sec = getDurationSeconds(v.formattedDuration);
                if (analysisFilters.type === 'shorts' && sec >= 180) return false;
                if (analysisFilters.type === 'long' && sec < 180) return false;
                
                return true;
            });

            newVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            setChannelAnalysisVideos(newVideos);
            addQuota(totalQuotaCost);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // 검색 실행
    const performSearch = async (isLoadMore = false) => {
        if (currentTab !== 'search' && !isLoadMore) setCurrentTab('search');
        if (!currentApiKey) return alert("API 키를 설정해주세요");

        setIsLoading(true);
        setError(null);
        if (!isLoadMore) { setSearchVideos([]); setNextPageToken(null); }

        const baseUrl = 'https://www.googleapis.com/youtube/v3';
        let currentQuota = 0;

        try {
            let initialUrl = '';
            let baseParams = `part=snippet&type=video&maxResults=50&key=${currentApiKey}`;
            if (isLoadMore && nextPageToken) baseParams += `&pageToken=${nextPageToken}`;

            if (searchText.trim()) {
                initialUrl = `${baseUrl}/search?${baseParams}&q=${encodeURIComponent(searchText)}`;
                
                if (searchFilters.date !== 'all') {
                    const now = new Date();
                    if (searchFilters.date === '1d') now.setDate(now.getDate() - 1);
                    else if (searchFilters.date === '3d') now.setDate(now.getDate() - 3);
                    else if (searchFilters.date === '1m') now.setMonth(now.getMonth() - 1);
                    else if (searchFilters.date === '6m') now.setMonth(now.getMonth() - 6);
                    initialUrl += `&publishedAfter=${now.toISOString()}`;
                }
                
                if (searchFilters.type === 'shorts') initialUrl += `&videoDuration=short`;
                if (searchFilters.viewCount.startsWith('o')) initialUrl += `&order=viewCount`;
                else initialUrl += `&order=relevance`;
                
                currentQuota += 100;
            } else {
                let chartParams = `part=snippet&chart=mostPopular&maxResults=50&regionCode=US&key=${currentApiKey}`;
                if (isLoadMore && nextPageToken) chartParams += `&pageToken=${nextPageToken}`;
                initialUrl = `${baseUrl}/videos?${chartParams}`;
                currentQuota += 1;
            }

            const res1 = await fetch(initialUrl);
            const data1 = await res1.json();
            if (data1.error) throw new Error(data1.error.message);

            const items = data1.items || [];
            setNextPageToken(data1.nextPageToken || null);
            if (items.length === 0) { addQuota(currentQuota); setIsLoading(false); return; }

            const videoIds = items.map(item => (item.id?.videoId) || (typeof item.id === 'string' ? item.id : null)).filter(Boolean).join(',');
            const channelIds = [...new Set(items.map(item => item.snippet.channelId))].join(',');

            const videosUrl = `${baseUrl}/videos?part=contentDetails,statistics,snippet,liveStreamingDetails&id=${videoIds}&key=${currentApiKey}`;
            const res2 = await fetch(videosUrl);
            const data2 = await res2.json();
            currentQuota += 1;

            const channelsUrl = `${baseUrl}/channels?part=statistics,snippet&id=${channelIds}&key=${currentApiKey}`;
            const res3 = await fetch(channelsUrl);
            const data3 = await res3.json();
            currentQuota += 1;

            const vMap = new Map(data2.items?.map(i => [i.id, i]));
            const cMap = new Map(data3.items?.map(i => [i.id, i]));

            const newVideos = items.map(item => {
                const vid = item.id?.videoId || item.id;
                const vDetail = vMap.get(vid);
                const cDetail = cMap.get(item.snippet.channelId);
                if (!vDetail) return null;
                
                return {
                    id: vid,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
                    publishedAt: item.snippet.publishedAt,
                    channelTitle: item.snippet.channelTitle,
                    channelId: item.snippet.channelId,
                    channelThumbnail: cDetail?.snippet?.thumbnails?.default?.url,
                    subscriberCount: parseInt(cDetail?.statistics?.subscriberCount || 0),
                    viewCount: parseInt(vDetail.statistics.viewCount || 0),
                    likeCount: parseInt(vDetail.statistics.likeCount || 0),
                    commentCount: parseInt(vDetail.statistics.commentCount || 0),
                    duration: vDetail.contentDetails.duration,
                    formattedDuration: parseDuration(vDetail.contentDetails.duration),
                    tags: vDetail.snippet.tags || [],
                    liveBroadcastContent: vDetail.snippet.liveBroadcastContent,
                    isLiveContent: !!vDetail.liveStreamingDetails
                };
            }).filter(Boolean);

            if (isLoadMore) setSearchVideos(prev => [...prev, ...newVideos]);
            else setSearchVideos(newVideos);
            
            addQuota(currentQuota);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // 필터링된 검색 결과
    const filteredSearchVideos = searchVideos.filter(v => {
        if (v.liveBroadcastContent !== 'none' || v.isLiveContent || v.duration === 'P0D') return false;
        
        const sec = getDurationSeconds(v.formattedDuration);
        if (searchFilters.type === 'shorts' && sec >= 180) return false;
        if (searchFilters.type === 'long' && sec < 180) return false;
        
        const sub = v.subscriberCount;
        if (searchFilters.subscriber === 'u5k' && sub > 5000) return false;
        if (searchFilters.subscriber === 'o10k' && sub < 10000) return false;
        if (searchFilters.subscriber === 'o50k' && sub < 50000) return false;
        if (searchFilters.subscriber === 'o100k' && sub < 100000) return false;
        if (searchFilters.subscriber === 'o1m' && sub < 1000000) return false;
        
        const views = v.viewCount;
        if (searchFilters.viewCount === 'u10k' && views > 10000) return false;
        if (searchFilters.viewCount === 'o10k' && views < 10000) return false;
        if (searchFilters.viewCount === 'o100k' && views < 100000) return false;
        if (searchFilters.viewCount === 'o500k' && views < 500000) return false;
        if (searchFilters.viewCount === 'o1m' && views < 1000000) return false;
        
        return true;
    });

    const targetChannelCount = savedChannels.filter(c => selectedCategory === '' || c.category === selectedCategory).length;

    // 현재 리스트 결정
    let currentList = [];
    if (currentTab === 'search') {
        currentList = filteredSearchVideos;
    } else if (currentTab === 'saved_video') {
        currentList = savedVideos.filter(v => {
            if (selectedVideoCategory !== '' && v.category !== selectedVideoCategory) return false;
            if (videoTypeFilter !== 'all') {
                const sec = getDurationSeconds(v.formattedDuration);
                if (videoTypeFilter === 'shorts' && sec >= 180) return false;
                if (videoTypeFilter === 'long' && sec < 180) return false;
            }
            return true;
        });
    } else if (currentTab === 'saved_channel') {
        if (isChannelAnalysisActive) currentList = channelAnalysisVideos;
        else currentList = savedChannels.filter(c => selectedCategory === '' || c.category === selectedCategory);
    }

    // ===== 렌더링 =====
    return (
        <div className="min-h-screen pb-8 relative">
            {/* 네비게이션 */}
            <nav className="sticky top-0 z-40 bg-bg-main/90 backdrop-blur border-b border-gray-800 shadow-sm">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-primary font-bold text-xl cursor-pointer" onClick={() => window.location.reload()}>
                        <Icon name="youtube" size={24} /> TubeDash
                    </div>
                    
                    <div className="flex-1 max-w-2xl relative flex gap-2">
                        <input 
                            type="text" 
                            value={searchText} 
                            onChange={(e) => setSearchText(e.target.value)} 
                            onKeyDown={(e) => { if (e.key === 'Enter') performSearch(false); }} 
                            placeholder="검색어 입력 (비우면 인기 영상)" 
                            className="w-full bg-bg-card border border-gray-700 rounded-lg pl-4 py-2 text-sm text-white focus:border-primary focus:outline-none" 
                        />
                        <button 
                            onClick={() => performSearch(false)} 
                            className="bg-primary hover:bg-primary-hover text-white px-4 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1"
                        >
                            <Icon name="search" size={16} /> 검색
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <QuotaDisplay keyQuotas={keyQuotas} currentKeyIndex={currentKeyIndex} />
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-gray-800 rounded-full text-text-sub hover:text-white">
                            <Icon name="settings" size={20} />
                        </button>
                    </div>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-6">
                {/* 탭 */}
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex items-center gap-2 border-b border-gray-700 pb-1">
                        <button onClick={() => setCurrentTab('search')} className={`px-4 py-2 text-sm font-bold border-b-2 transition ${currentTab === 'search' ? 'border-primary text-white' : 'border-transparent text-text-sub hover:text-white'}`}>
                            <Icon name="search" size={14} className="inline mr-1" /> 검색
                        </button>
                        <button onClick={() => fetchSavedAssets('video')} className={`px-4 py-2 text-sm font-bold border-b-2 transition ${currentTab === 'saved_video' ? 'border-emerald-500 text-white' : 'border-transparent text-text-sub hover:text-white'}`}>
                            <Icon name="video" size={14} className="inline mr-1" /> 영상 보관함
                        </button>
                        <button onClick={() => fetchSavedAssets('channel')} className={`px-4 py-2 text-sm font-bold border-b-2 transition ${currentTab === 'saved_channel' ? 'border-blue-500 text-white' : 'border-transparent text-text-sub hover:text-white'}`}>
                            <Icon name="users" size={14} className="inline mr-1" /> 채널 보관함
                        </button>
                    </div>

                    {/* 필터 영역 */}
                    <div className="flex flex-wrap gap-2 items-center min-h-[40px]">
                        {currentTab === 'search' && (
                            <>
                                <div className="bg-bg-card border border-gray-700 rounded-lg p-1 flex">
                                    {['all', 'shorts', 'long'].map(t => (
                                        <button key={t} onClick={() => setSearchFilters({ ...searchFilters, type: t })} className={`px-3 py-1.5 text-xs rounded transition ${searchFilters.type === t ? 'bg-primary text-white' : 'text-text-sub hover:text-white'}`}>
                                            {t === 'all' ? '전체' : t === 'shorts' ? '숏폼' : '롱폼'}
                                        </button>
                                    ))}
                                </div>
                                <select className="bg-bg-card border border-gray-700 text-text-sub text-xs rounded-lg px-3 py-2 outline-none" value={searchFilters.date} onChange={(e) => setSearchFilters({ ...searchFilters, date: e.target.value })}>
                                    <option value="all">기간: 전체</option>
                                    <option value="1d">1일</option>
                                    <option value="3d">3일</option>
                                    <option value="1m">1개월</option>
                                    <option value="6m">6개월</option>
                                </select>
                                <select className="bg-bg-card border border-gray-700 text-text-sub text-xs rounded-lg px-3 py-2 outline-none" value={searchFilters.subscriber} onChange={(e) => setSearchFilters({ ...searchFilters, subscriber: e.target.value })}>
                                    <option value="all">구독자 전체</option>
                                    <option value="u5k">5천 이하</option>
                                    <option value="o10k">1만 이상</option>
                                    <option value="o50k">5만 이상</option>
                                    <option value="o100k">10만 이상</option>
                                    <option value="o1m">100만 이상</option>
                                </select>
                                <select className="bg-bg-card border border-gray-700 text-text-sub text-xs rounded-lg px-3 py-2 outline-none" value={searchFilters.viewCount} onChange={(e) => setSearchFilters({ ...searchFilters, viewCount: e.target.value })}>
                                    <option value="all">조회수 전체</option>
                                    <option value="u10k">1만 이하</option>
                                    <option value="o10k">1만 이상</option>
                                    <option value="o100k">10만 이상</option>
                                    <option value="o500k">50만 이상</option>
                                    <option value="o1m">100만 이상</option>
                                </select>
                                <div className="text-[10px] text-gray-500 flex items-center gap-1 ml-2">
                                    <Icon name="zap" size={10} />
                                    {searchText.trim() ? '예상: ~102' : '예상: ~3'} 쿼터
                                </div>
                            </>
                        )}

                        {currentTab === 'saved_video' && (
                            <>
                                <div className="flex items-center gap-2 bg-bg-card border border-gray-700 px-3 py-1.5 rounded-lg">
                                    <span className="text-xs text-gray-400">카테고리</span>
                                    <select className="bg-gray-800 text-white text-xs p-1 rounded border border-gray-600 outline-none" value={selectedVideoCategory} onChange={(e) => setSelectedVideoCategory(e.target.value)}>
                                        <option value="">전체</option>
                                        {getExistingVideoCategories().map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                                    </select>
                                </div>
                                <div className="bg-bg-card border border-gray-700 rounded-lg p-1 flex">
                                    {['all', 'shorts', 'long'].map(t => (
                                        <button key={t} onClick={() => setVideoTypeFilter(t)} className={`px-3 py-1.5 text-xs rounded transition ${videoTypeFilter === t ? 'bg-primary text-white' : 'text-text-sub hover:text-white'}`}>
                                            {t === 'all' ? '전체' : t === 'shorts' ? '숏폼' : '롱폼'}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => setIsAddVideoOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 shadow transition">
                                    <Icon name="plus" size={12} /> 영상 추가
                                </button>
                                <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                    <Icon name="zap" size={10} /> ~2 쿼터/개
                                </div>
                            </>
                        )}

                        {currentTab === 'saved_channel' && (
                            <>
                                {!isChannelAnalysisActive && (
                                    <div className="flex items-center gap-2 bg-bg-card border border-gray-700 px-3 py-1.5 rounded-lg">
                                        <span className="text-xs text-gray-400">카테고리</span>
                                        <select className="bg-gray-800 text-white text-xs p-1 rounded border border-gray-600 outline-none" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                                            <option value="">전체</option>
                                            {getExistingCategories().map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                                        </select>
                                    </div>
                                )}
                                <select className="bg-bg-card border border-gray-700 text-text-sub text-xs rounded-lg px-3 py-2 outline-none" value={analysisFilters.date} onChange={(e) => setAnalysisFilters({ ...analysisFilters, date: e.target.value })}>
                                    <option value="all">기간: 전체</option>
                                    <option value="1d">1일</option>
                                    <option value="3d">3일</option>
                                    <option value="1m">1개월</option>
                                    <option value="6m">6개월</option>
                                </select>
                                <select className="bg-bg-card border border-gray-700 text-text-sub text-xs rounded-lg px-3 py-2 outline-none" value={analysisFilters.viewCount} onChange={(e) => setAnalysisFilters({ ...analysisFilters, viewCount: e.target.value })}>
                                    <option value="all">조회수 전체</option>
                                    <option value="u10k">1만 이하</option>
                                    <option value="o10k">1만 이상</option>
                                    <option value="o100k">10만 이상</option>
                                    <option value="o500k">50만 이상</option>
                                    <option value="o1m">100만 이상</option>
                                </select>
                                {!isChannelAnalysisActive && (
                                    <button onClick={() => setIsAddChannelOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 shadow transition">
                                        <Icon name="plus" size={12} /> 채널 추가
                                    </button>
                                )}
                                <EstimatedQuota channelCount={targetChannelCount} isVisible={!isChannelAnalysisActive && targetChannelCount > 0} />
                                <button onClick={analyzeChannelVideos} className="bg-primary hover:bg-primary-hover text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1 shadow transition">
                                    <Icon name="search" size={12} /> {isChannelAnalysisActive ? '다시 분석' : '채널 분석'}
                                </button>
                                {isChannelAnalysisActive && (
                                    <button onClick={() => setIsChannelAnalysisActive(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1 shadow transition ml-auto">
                                        <Icon name="arrow-left" size={12} /> 목록으로
                                    </button>
                                )}
                            </>
                        )}

                        {/* 뷰 모드 전환 */}
                        {!(currentTab === 'saved_channel' && !isChannelAnalysisActive) && (
                            <div className="ml-auto bg-bg-card border border-gray-700 rounded-lg p-1 flex">
                                <button onClick={() => setViewMode('card')} className={`p-2 rounded ${viewMode === 'card' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>
                                    <Icon name="layout-grid" size={16} />
                                </button>
                                <button onClick={() => setViewMode('table')} className={`p-2 rounded ${viewMode === 'table' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>
                                    <Icon name="list" size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 컨텐츠 영역 */}
                {isLoading && currentList.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-text-sub">
                        <Icon name="loader-2" size={40} className="animate-spin mb-4 text-primary" />
                        <p>데이터를 불러오는 중...</p>
                    </div>
                ) : error ? (
                    <div className="py-10 text-center border border-red-900 bg-red-900/10 rounded-xl text-red-400">
                        <p>{error}</p>
                    </div>
                ) : currentList.length === 0 ? (
                    <div className="py-20 text-center text-text-sub border-2 border-dashed border-gray-800 rounded-xl">
                        <Icon name="search" size={48} className="mx-auto mb-4 opacity-30" />
                        <p>
                            {currentTab === 'search' ? '검색 결과가 없습니다.' : 
                             (currentTab === 'saved_channel' && isChannelAnalysisActive) ? '조건에 맞는 영상이 없습니다.' : 
                             '저장된 항목이 없습니다.'}
                        </p>
                    </div>
                ) : currentTab === 'saved_channel' && !isChannelAnalysisActive ? (
                    // 채널 목록 (카드 형태)
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {currentList.map(c => (
                            <div key={c.dbId} className="bg-bg-card border border-gray-700 rounded-xl p-4 flex items-center gap-4 relative group hover:border-gray-500 transition">
                                <img 
                                    src={c.thumbnail} 
                                    className="w-14 h-14 rounded-full bg-gray-700 object-cover cursor-pointer" 
                                    onClick={() => window.open(`https://www.youtube.com/channel/${c.channelId}`, '_blank')} 
                                />
                                <div className="flex-1 overflow-hidden">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded border border-gray-600">
                                            {c.category || '미분류'}
                                        </span>
                                    </div>
                                    <h3 
                                        className="font-bold text-gray-200 truncate cursor-pointer hover:underline" 
                                        onClick={() => window.open(`https://www.youtube.com/channel/${c.channelId}`, '_blank')}
                                    >
                                        {c.channelTitle}
                                    </h3>
                                    <div className="text-xs text-text-sub mt-0.5">
                                        구독자 {formatNumber(c.subscriberCount)}
                                    </div>
                                </div>
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={() => handleChangeCategory(c)} className="p-1.5 text-gray-500 hover:text-blue-400 bg-gray-800/80 rounded" title="카테고리 변경">
                                        <Icon name="folder" size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(c.dbId, 'channel_assets', c.channelId)} className="p-1.5 text-gray-500 hover:text-red-400 bg-gray-800/80 rounded" title="삭제">
                                        <Icon name="trash" size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : viewMode === 'card' ? (
                    // 영상 카드 뷰
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {currentList.map(v => (
                            <div key={v.dbId || v.id} className="bg-bg-card rounded-xl border border-gray-800 overflow-hidden hover:border-gray-600 transition group flex flex-col relative">
                                <div className="relative aspect-video bg-black cursor-pointer" onClick={() => window.open(`https://www.youtube.com/watch?v=${v.id}`, '_blank')}>
                                    <img src={v.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                                        {v.formattedDuration}
                                    </span>
                                </div>
                                <div className="p-4 flex-1 flex flex-col">
                                    <h3 
                                        className="text-sm font-bold text-gray-200 line-clamp-2 mb-2 leading-tight cursor-pointer hover:underline" 
                                        onClick={() => window.open(`https://www.youtube.com/watch?v=${v.id}`, '_blank')}
                                    >
                                        {v.title}
                                    </h3>
                                    <div className="flex items-center gap-2 mb-3">
                                        {v.channelThumbnail && <img src={v.channelThumbnail} className="w-5 h-5 rounded-full bg-gray-700" />}
                                        <span className="text-xs text-text-sub truncate">{v.channelTitle}</span>
                                    </div>
                                    <div className="mt-auto space-y-3">
                                        <div className="flex justify-between items-center text-xs text-gray-400 bg-gray-900/50 p-2 rounded-lg">
                                            <span>조회수 {formatNumber(v.viewCount)}</span>
                                            <div className="w-px h-3 bg-gray-700"></div>
                                            <span>구독자 {formatNumber(v.subscriberCount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] text-text-muted px-1">
                                            <span className="flex items-center gap-1"><Icon name="calendar" size={12} /> {formatDate(v.publishedAt)}</span>
                                            <span className="flex items-center gap-1"><Icon name="thumbs-up" size={12} /> {formatNumber(v.likeCount)}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
                                            {(currentTab === 'search' || isChannelAnalysisActive) ? (
    <>
        <button 
            onClick={() => handleSaveVideo(v)} 
            disabled={savedVideoIds.has(v.id)} 
            className={`flex items-center justify-center gap-1 py-1.5 text-xs rounded transition ${savedVideoIds.has(v.id) ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-800 hover:bg-emerald-600 hover:text-white text-gray-400'}`}
        >
            <Icon name="bookmark" size={12} /> {savedVideoIds.has(v.id) ? '저장됨' : '저장'}
        </button>
        <button 
            onClick={() => handleSaveChannel(v)} 
            disabled={savedChannelIds.has(v.channelId)} 
            className={`flex items-center justify-center gap-1 py-1.5 text-xs rounded transition ${savedChannelIds.has(v.channelId) ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-800 hover:bg-blue-600 hover:text-white text-gray-400'}`}
        >
            <Icon name="user-plus" size={12} /> {savedChannelIds.has(v.channelId) ? '저장됨' : '채널'}
        </button>
       <button 
    onClick={() => {
        console.log('클릭한 비디오:', v);
        console.log('비디오 키들:', Object.keys(v));
        setKeywordTargetVideo(v);
        setIsKeywordModalOpen(true);
        setExtractedKeywords([]);
        setManualScript('');
        setUseManualScript(false);
    }}
    disabled={v.keywordsExtracted}
    className={`col-span-2 flex items-center justify-center gap-1 py-1.5 text-xs rounded transition mt-1 ${
        v.keywordsExtracted 
            ? 'bg-green-900/30 text-green-400 cursor-default' 
            : 'bg-yellow-900/30 hover:bg-yellow-600 text-yellow-400 hover:text-white'
    }`}
>
    <Icon name={v.keywordsExtracted ? "check" : "zap"} size={12} /> 
    {v.keywordsExtracted ? '분석완료' : '키워드 추출'}
</button>

    </>

                                            ) : currentTab === 'saved_video' ? (
    <div className="col-span-2 space-y-2">
        <div className="flex gap-2">
            <button 
                onClick={() => handleChangeVideoCategory(v)} 
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-gray-800 hover:bg-blue-600 text-gray-400 hover:text-white rounded transition"
            >
                <Icon name="folder" size={12} /> {v.category || '미분류'}
            </button>
            <button 
                onClick={() => handleDelete(v.dbId, 'video_assets', v.id)} 
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white rounded transition"
            >
                <Icon name="trash" size={12} /> 삭제
            </button>
        </div>
        <button 
    onClick={() => {
        console.log('클릭한 비디오:', v);
        console.log('비디오 키들:', Object.keys(v));
        setKeywordTargetVideo(v);
        setIsKeywordModalOpen(true);
        setExtractedKeywords([]);
        setManualScript('');
        setUseManualScript(false);
    }}
    disabled={v.keywordsExtracted}
    className={`w-full flex items-center justify-center gap-1 py-1.5 text-xs rounded transition ${
        v.keywordsExtracted 
            ? 'bg-green-900/30 text-green-400 cursor-default' 
            : 'bg-yellow-900/30 hover:bg-yellow-600 text-yellow-400 hover:text-white'
    }`}
>
    <Icon name={v.keywordsExtracted ? "check" : "zap"} size={12} /> 
    {v.keywordsExtracted ? '분석완료' : '키워드 추출'}
</button>


    </div>

                                            ) : (
                                                <button 
                                                    onClick={() => handleDelete(v.dbId, 'video_assets', v.id)} 
                                                    className="col-span-2 flex items-center justify-center gap-1 py-1.5 text-xs bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white rounded transition"
                                                >
                                                    <Icon name="trash" size={12} /> 삭제
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // 테이블 뷰
                    <div className="bg-bg-card rounded-xl border border-gray-800 overflow-hidden">
                        <table className="w-full text-left text-sm text-gray-300">
                            <thead className="bg-gray-900 text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="p-3">Video</th>
                                    <th className="p-3">Channel</th>
                                    <th className="p-3 text-center">Views</th>
                                    <th className="p-3 text-center">Likes</th>
                                    <th className="p-3 text-center">Date</th>
                                    <th className="p-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {currentList.map(v => (
                                    <tr key={v.dbId || v.id} className="hover:bg-gray-800/50">
                                        <td className="p-3 flex gap-3 items-center">
                                            <div className="relative min-w-[100px] w-[100px] cursor-pointer" onClick={() => window.open(`https://www.youtube.com/watch?v=${v.id}`, '_blank')}>
                                                <img src={v.thumbnail} className="w-full aspect-video object-cover rounded" />
                                                <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded">{v.formattedDuration}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-sm line-clamp-2 cursor-pointer hover:underline" onClick={() => window.open(`https://www.youtube.com/watch?v=${v.id}`, '_blank')}>
                                                    {v.title}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="text-sm text-gray-300">{v.channelTitle}</div>
                                            <div className="text-xs text-gray-500">구독자 {formatNumber(v.subscriberCount)}</div>
                                        </td>
                                        <td className="p-3 text-center text-sm text-gray-400">{formatNumber(v.viewCount)}</td>
                                        <td className="p-3 text-center text-sm text-gray-400">{formatNumber(v.likeCount)}</td>
                                        <td className="p-3 text-center text-xs text-gray-500">{formatDate(v.publishedAt)}</td>
                                        <td className="p-3 text-center">
                                            {(currentTab === 'search' || isChannelAnalysisActive) ? (
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleSaveVideo(v)} disabled={savedVideoIds.has(v.id)} className={`p-1.5 rounded ${savedVideoIds.has(v.id) ? 'bg-gray-700 text-gray-500' : 'bg-gray-700 hover:bg-emerald-500 text-white'}`}>
                                                        <Icon name="bookmark" size={14} />
                                                    </button>
                                                    <button onClick={() => handleSaveChannel(v)} disabled={savedChannelIds.has(v.channelId)} className={`p-1.5 rounded ${savedChannelIds.has(v.channelId) ? 'bg-gray-700 text-gray-500' : 'bg-gray-700 hover:bg-blue-500 text-white'}`}>
                                                        <Icon name="user-plus" size={14} />
                                                    </button>
                                                </div>
                                            ) : currentTab === 'saved_video' ? (
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleChangeVideoCategory(v)} className="p-1.5 rounded bg-gray-700 hover:bg-blue-500 text-white" title="카테고리 변경">
                                                        <Icon name="folder" size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(v.dbId, 'video_assets', v.id)} className="p-1.5 bg-red-900/30 text-red-400 hover:bg-red-500 hover:text-white rounded">
                                                        <Icon name="trash" size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleDelete(v.dbId, 'video_assets', v.id)} className="p-1.5 bg-red-900/30 text-red-400 hover:bg-red-500 hover:text-white rounded">
                                                    <Icon name="trash" size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 더보기 버튼 */}
            {currentTab === 'search' && !isLoading && nextPageToken && currentList.length > 0 && (
                <div className="flex justify-center py-6">
                    <button onClick={() => performSearch(true)} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 border border-gray-600 transition transform hover:scale-105">
                        <Icon name="list" size={18} /> 더 보기
                    </button>
                </div>
            )}

            {/* 토스트 */}
            {toast && (
                <div className={`fixed bottom-8 right-4 px-4 py-3 rounded-lg shadow-xl text-white text-sm font-bold flex items-center gap-2 z-50 toast-enter ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                    {toast.type === 'error' ? <Icon name="x" size={16} /> : <Icon name="thumbs-up" size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* 설정 모달 */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-bg-card border border-gray-700 rounded-xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Icon name="settings" size={20} className="text-primary" /> 설정
                            </h2>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-white">
                                <Icon name="x" size={20} />
                            </button>
                        </div>
                        
                        {/* API 키 관리 */}
                        <div className="mb-6">
                            <h3 className="font-medium mb-3 flex items-center gap-2">
                                <Icon name="key" size={16} /> API 키 관리
                            </h3>
                            <div className="space-y-2">
                                {CONFIG.API_KEYS.map((key, index) => {
                                    const usage = keyQuotas.keys[index]?.used || 0;
                                    const percent = (usage / CONFIG.DAILY_QUOTA_LIMIT) * 100;
                                    const isActive = index === currentKeyIndex;
                                    
                                    return (
                                        <div key={index} className={`p-3 rounded-lg border ${isActive ? 'border-primary bg-primary/10' : 'border-gray-700 bg-gray-800/50'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium">
                                                    키 {index + 1} {isActive && <span className="text-primary">(사용 중)</span>}
                                                </span>
                                                <button
                                                    onClick={() => switchApiKey(index)}
                                                    disabled={isActive}
                                                    className={`text-xs px-2 py-1 rounded ${isActive ? 'bg-gray-600 text-gray-400' : 'bg-primary hover:bg-primary-hover text-white'}`}
                                                >
                                                    {isActive ? '현재 키' : '전환'}
                                                </button>
                                            </div>
                                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all ${percent >= 80 ? 'bg-red-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                                    style={{ width: `${Math.min(percent, 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1 text-xs text-gray-400">
                                                <span>{usage.toLocaleString()} / {CONFIG.DAILY_QUOTA_LIMIT.toLocaleString()}</span>
                                                <span>{percent.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <button
                                onClick={resetQuota}
                                className="mt-3 w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition flex items-center justify-center gap-2"
                            >
                                <Icon name="refresh-cw" size={14} /> 사용량 초기화
                            </button>
                        </div>

                        {/* Supabase 설정 */}
                        <div className="space-y-4 border-t border-gray-700 pt-4">
                            <h3 className="font-medium">Supabase 설정</h3>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Supabase URL</label>
                                <input
                                    type="text"
                                    value={settings.supabaseUrl}
                                    onChange={(e) => setSettings({ ...settings, supabaseUrl: e.target.value })}
                                    className="w-full bg-bg-main border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                    placeholder="https://xxx.supabase.co"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Supabase Anon Key</label>
                                <input
                                    type="password"
                                    value={settings.supabaseKey}
                                    onChange={(e) => setSettings({ ...settings, supabaseKey: e.target.value })}
                                    className="w-full bg-bg-main border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                    placeholder="eyJ..."
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 영상 추가 모달 */}
            {isAddVideoOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-bg-card border border-gray-700 rounded-xl w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Icon name="video" size={20} className="text-emerald-500" /> 영상 직접 추가
                            </h2>
                            <button onClick={() => setIsAddVideoOpen(false)} className="text-gray-500 hover:text-white">
                                <Icon name="x" size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">영상 URL 또는 ID</label>
                                <input
                                    type="text"
                                    value={videoInput}
                                    onChange={(e) => setVideoInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddVideoByUrl(); }}
                                    className="w-full bg-bg-main border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                    placeholder="예: https://youtube.com/watch?v=xxxxx"
                                />
                            </div>
                            <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400">
                                <p className="font-bold text-gray-300 mb-2">💡 입력 가능한 형식:</p>
                                <ul className="space-y-1 ml-2">
                                    <li>• https://youtube.com/watch?v=VIDEO_ID</li>
                                    <li>• https://youtu.be/VIDEO_ID</li>
                                    <li>• https://youtube.com/shorts/VIDEO_ID</li>
                                    <li>• VIDEO_ID (11자)</li>
                                </ul>
                                <p className="mt-2 text-yellow-500">⚡ 영상당 ~2 쿼터 소모</p>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setIsAddVideoOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                                취소
                            </button>
                            <button
                                onClick={handleAddVideoByUrl}
                                disabled={isAddingVideo}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                {isAddingVideo ? (
                                    <><Icon name="loader-2" size={14} className="animate-spin" /> 추가 중...</>
                                ) : (
                                    <><Icon name="plus" size={14} /> 추가</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 채널 추가 모달 */}
            {isAddChannelOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-bg-card border border-gray-700 rounded-xl w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Icon name="link" size={20} className="text-emerald-500" /> 채널 직접 추가
                            </h2>
                            <button onClick={() => setIsAddChannelOpen(false)} className="text-gray-500 hover:text-white">
                                <Icon name="x" size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">채널 URL 또는 핸들</label>
                                <input
                                    type="text"
                                    value={channelInput}
                                    onChange={(e) => setChannelInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddChannelByUrl(); }}
                                    className="w-full bg-bg-main border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                    placeholder="예: https://youtube.com/@채널핸들 또는 @핸들"
                                />
                            </div>
                            <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400">
                                <p className="font-bold text-gray-300 mb-2">💡 입력 가능한 형식:</p>
                                <ul className="space-y-1 ml-2">
                                    <li>• https://youtube.com/@핸들 <span className="text-yellow-500">(~101 쿼터)</span></li>
                                    <li>• https://youtube.com/channel/UC... <span className="text-emerald-500">(~1 쿼터)</span></li>
                                    <li>• @핸들 <span className="text-yellow-500">(~101 쿼터)</span></li>
                                    <li>• UC... (채널ID) <span className="text-emerald-500">(~1 쿼터)</span></li>
                                </ul>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setIsAddChannelOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                                취소
                            </button>
                            <button
                                onClick={handleAddChannelByUrl}
                                disabled={isAddingChannel}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                {isAddingChannel ? (
                                    <><Icon name="loader-2" size={14} className="animate-spin" /> 검색 중...</>
                                ) : (
                                    <><Icon name="search" size={14} /> 검색 및 추가</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 채널 카테고리 선택 모달 */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-bg-card border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Icon name="folder" size={20} className="text-blue-500" /> 
                                {pendingChannelData?.isEdit ? '카테고리 변경' : '카테고리 선택'}
                            </h2>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-500 hover:text-white">
                                <Icon name="x" size={20} />
                            </button>
                        </div>
                        
                        {pendingChannelData && (
                            <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg mb-4">
                                <img src={pendingChannelData.thumbnail} className="w-12 h-12 rounded-full bg-gray-700" />
                                <div>
                                    <div className="font-bold text-white">{pendingChannelData.channelTitle}</div>
                                    <div className="text-xs text-gray-400">구독자 {formatNumber(pendingChannelData.subscriberCount)}</div>
                                </div>
                            </div>
                        )}
                        
                        <div className="space-y-4">
                            {getExistingCategories().length > 0 && !isCreatingNewCategory && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">기존 카테고리</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                        {getExistingCategories().map(cat => (
                                            <button 
                                                key={cat} 
                                                onClick={() => setSelectedCategoryForSave(cat)} 
                                                className={`p-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${selectedCategoryForSave === cat ? 'bg-primary text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                                            >
                                                {selectedCategoryForSave === cat && <Icon name="check" size={14} />}
                                                <Icon name="folder" size={14} className="opacity-50" />
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {getExistingCategories().length > 0 && !isCreatingNewCategory && (
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-gray-700"></div>
                                    <span className="text-xs text-gray-500">또는</span>
                                    <div className="flex-1 h-px bg-gray-700"></div>
                                </div>
                            )}
                            
                            {!isCreatingNewCategory ? (
                                <button 
                                    onClick={() => { setIsCreatingNewCategory(true); setSelectedCategoryForSave(''); }} 
                                    className="w-full p-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-primary hover:text-primary transition flex items-center justify-center gap-2"
                                >
                                    <Icon name="folder-plus" size={16} /> 새 카테고리 만들기
                                </button>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm text-gray-400">새 카테고리 이름</label>
                                        {getExistingCategories().length > 0 && (
                                            <button onClick={() => setIsCreatingNewCategory(false)} className="text-xs text-gray-500 hover:text-white">
                                                기존 선택으로
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        className="w-full bg-bg-main border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                        placeholder="카테고리 이름 입력"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => { setIsCategoryModalOpen(false); setPendingChannelData(null); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                                취소
                            </button>
                            <button 
                                onClick={confirmSaveChannel} 
                                disabled={!isCreatingNewCategory && !selectedCategoryForSave} 
                                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                <Icon name="check" size={14} /> {pendingChannelData?.isEdit ? '변경' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 영상 카테고리 선택 모달 */}
            {isVideoCategoryModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-bg-card border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Icon name="folder" size={20} className="text-emerald-500" /> 
                                {pendingVideoData?.isEdit ? '영상 카테고리 변경' : '영상 카테고리 선택'}
                            </h2>
                            <button onClick={() => setIsVideoCategoryModalOpen(false)} className="text-gray-500 hover:text-white">
                                <Icon name="x" size={20} />
                            </button>
                        </div>
                        
                        {pendingVideoData && (
                            <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg mb-4">
                                <img src={pendingVideoData.thumbnail} className="w-20 h-12 rounded bg-gray-700 object-cover" />
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-white text-sm line-clamp-2">{pendingVideoData.title}</div>
                                    <div className="text-xs text-gray-400">{pendingVideoData.channelTitle}</div>
                                </div>
                            </div>
                        )}
                        
                        <div className="space-y-4">
                            {getExistingVideoCategories().length > 0 && !isCreatingNewCategory && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">기존 카테고리</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                        {getExistingVideoCategories().map(cat => (
                                            <button 
                                                key={cat} 
                                                onClick={() => setSelectedCategoryForSave(cat)} 
                                                className={`p-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${selectedCategoryForSave === cat ? 'bg-primary text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                                            >
                                                {selectedCategoryForSave === cat && <Icon name="check" size={14} />}
                                                <Icon name="folder" size={14} className="opacity-50" />
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {getExistingVideoCategories().length > 0 && !isCreatingNewCategory && (
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-gray-700"></div>
                                    <span className="text-xs text-gray-500">또는</span>
                                    <div className="flex-1 h-px bg-gray-700"></div>
                                </div>
                            )}
                            
                            {!isCreatingNewCategory ? (
                                <button 
                                    onClick={() => { setIsCreatingNewCategory(true); setSelectedCategoryForSave(''); }} 
                                    className="w-full p-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-primary hover:text-primary transition flex items-center justify-center gap-2"
                                >
                                    <Icon name="folder-plus" size={16} /> 새 카테고리 만들기
                                </button>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm text-gray-400">새 카테고리 이름</label>
                                        {getExistingVideoCategories().length > 0 && (
                                            <button onClick={() => setIsCreatingNewCategory(false)} className="text-xs text-gray-500 hover:text-white">
                                                기존 선택으로
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        className="w-full bg-bg-main border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                        placeholder="카테고리 이름 입력"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => { setIsVideoCategoryModalOpen(false); setPendingVideoData(null); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                                취소
                            </button>
                            <button 
                                onClick={confirmSaveVideoWithCategory} 
                                disabled={!isCreatingNewCategory && !selectedCategoryForSave} 
                                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                <Icon name="check" size={14} /> {pendingVideoData?.isEdit ? '변경' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 키워드 추출 모달 */}
{isKeywordModalOpen && (
    <div 
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={(e) => {
            if (e.target === e.currentTarget) {
                setIsKeywordModalOpen(false);
                setManualScript('');
                setUseManualScript(false);
                setExtractedKeywords([]);
                setKeywordTranscriptInfo(null);
                setVideoType(null);
                setVideoTypeMessage(null);
                setExpandedKeyword(null);
            }
        }}
    >
        <div className="bg-bg-card border border-gray-700 rounded-xl w-full max-w-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Icon name="zap" size={20} className="text-yellow-500" /> 
                    키워드 추출
                </h2>
                <button onClick={() => {
                    setIsKeywordModalOpen(false);
                    setManualScript('');
                    setUseManualScript(false);
                    setExtractedKeywords([]);
                    setKeywordTranscriptInfo(null);
                    setVideoType(null);
                    setVideoTypeMessage(null);
                    setExpandedKeyword(null);
                }} className="text-gray-500 hover:text-white">
                    <Icon name="x" size={20} />
                </button>
            </div>
            
            {/* 영상 정보 */}
            {keywordTargetVideo && (
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg mb-4">
                    <img src={keywordTargetVideo.thumbnail} className="w-24 h-14 rounded bg-gray-700 object-cover" />
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm line-clamp-2">{keywordTargetVideo.title}</div>
                        <div className="text-xs text-gray-400">{keywordTargetVideo.channelTitle}</div>
                    </div>
                </div>
            )}
            
            {/* 스크립트 입력 방식 선택 */}
            {!isExtractingKeywords && extractedKeywords.length === 0 && (
                <div className="mb-4 space-y-3">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setUseManualScript(false)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                                !useManualScript 
                                    ? 'bg-primary text-white' 
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                        >
                            🤖 자동 추출
                        </button>
                        <button
                            onClick={() => setUseManualScript(true)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                                useManualScript 
                                    ? 'bg-primary text-white' 
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                        >
                            ✍️ 스크립트 직접 입력
                        </button>
                    </div>
                    
                    {useManualScript && (
                        <div>
                            <textarea
                                value={manualScript}
                                onChange={(e) => setManualScript(e.target.value)}
                                placeholder="유튜브에서 복사한 스크립트를 여기에 붙여넣으세요..."
                                className="w-full h-32 bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none outline-none focus:border-primary"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                💡 유튜브 영상 → 더보기(...) → 스크립트 보기 → 전체 복사
                            </p>
                        </div>
                    )}
                    
                    <button
                        onClick={() => handleExtractKeywords(keywordTargetVideo, useManualScript ? manualScript : null)}
                        disabled={useManualScript && !manualScript.trim()}
                        className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-bold transition"
                    >
                        키워드 추출 시작
                    </button>
                </div>
            )}
            
            {/* 로딩 중 */}
            {isExtractingKeywords && (
                <div className="py-10 text-center">
                    <Icon name="loader-2" size={40} className="animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-gray-400">키워드 추출 중...</p>
                    <p className="text-xs text-gray-500 mt-2">YouTube에서 터진 영상 검색 중...</p>
                </div>
            )}
            
            {/* 결과 표시 */}
            {!isExtractingKeywords && extractedKeywords.length > 0 && (
                <div className="space-y-4">
                    {/* 스크립트 상태 */}
                    {keywordTranscriptInfo && (
                        <div className="p-3 rounded-lg bg-gray-800/50 text-sm">
                            {keywordTranscriptInfo.hasTranscript ? (
                                <span className="text-green-400 flex items-center gap-2">
                                    <Icon name="check-circle" size={16} />
                                    {keywordTranscriptInfo.isManual ? '수동 입력' : '자동 추출'} 스크립트 포함 ({keywordTranscriptInfo.length.toLocaleString()}자)
                                </span>
                            ) : (
                                <span className="text-yellow-400 flex items-center gap-2">
                                    <Icon name="alert-circle" size={16} />
                                    스크립트 없음 (제목+태그만 분석)
                                </span>
                            )}
                        </div>
                    )}
                    
                    {/* 영상 유형 표시 */}
                    {videoType && (
                        <div className={`p-3 rounded-lg text-sm ${
                            videoType === 'keyword' 
                                ? 'bg-blue-900/30 border border-blue-700' 
                                : 'bg-orange-900/30 border border-orange-700'
                        }`}>
                            {videoType === 'keyword' ? (
                                <span className="text-blue-400 flex items-center gap-2">
                                    <Icon name="search" size={16} />
                                    <strong>키워드형 영상</strong> - 검색/추천으로 유입되는 영상
                                </span>
                            ) : (
                                <span className="text-orange-400 flex items-center gap-2">
                                    <Icon name="sparkles" size={16} />
                                    <strong>콘텐츠형 영상</strong> - {videoTypeMessage}
                                </span>
                            )}
                        </div>
                    )}
                    
                    {/* 키워드 카드 목록 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-400">
                                추출된 키워드 <span className="text-white font-bold">{extractedKeywords.length}개</span>
                            </p>
                            <div className="flex gap-3 text-xs">
                                <span className="flex items-center gap-1 text-red-400">
                                    <span className="w-2 h-2 bg-red-400 rounded-full"></span> HOT (50%+)
                                </span>
                                <span className="flex items-center gap-1 text-yellow-400">
                                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span> 가능성 (20%+)
                                </span>
                            </div>
                        </div>
                        
                        {extractedKeywords.map((kw, index) => (
                            <div 
                                key={index} 
                                className={`rounded-lg border overflow-hidden ${
                                    kw.type === 'hot' 
                                        ? 'bg-red-900/20 border-red-700' 
                                        : kw.type === 'potential'
                                            ? 'bg-yellow-900/20 border-yellow-700'
                                            : 'bg-gray-800 border-gray-700'
                                }`}
                            >
                                {/* 키워드 헤더 */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-white">{kw.keyword}</span>
                                            {kw.type === 'hot' && <span className="text-red-400 text-xs">🔥 HOT</span>}
                                            {kw.type === 'potential' && <span className="text-yellow-400 text-xs">⚡ 가능성</span>}
                                        </div>
                                        <div className="flex gap-1">
                                            {kw.sources.map((src, i) => (
                                                <span key={i} className={`text-xs px-2 py-0.5 rounded ${
                                                    src === 'title' ? 'bg-blue-900/50 text-blue-400' :
                                                    src === 'tag' ? 'bg-purple-900/50 text-purple-400' :
                                                    src === 'hashtag' ? 'bg-pink-900/50 text-pink-400' :
                                                    'bg-gray-700 text-gray-400'
                                                }`}>
                                                    {src === 'title' ? '제목' : 
                                                     src === 'tag' ? '태그' : 
                                                     src === 'hashtag' ? '해시태그' : '스크립트'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* 통계 */}
                                    <div className="flex items-center gap-4 text-sm mb-3">
                                        {kw.hitVideos !== null && kw.hitVideos !== undefined && (
                                            <div className="flex items-center gap-1">
                                                <Icon name="trending-up" size={14} className="text-gray-500" />
                                                <span className="text-gray-400">100만+ 영상:</span>
                                                <span className={`font-bold ${
                                                    kw.hitRate >= 50 ? 'text-red-400' :
                                                    kw.hitRate >= 20 ? 'text-yellow-400' :
                                                    'text-gray-500'
                                                }`}>
                                                    {kw.totalSearched}개 중 {kw.hitVideos}개 ({kw.hitRate}%)
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {kw.hashtagCount !== null && kw.hashtagCount !== undefined && (
                                        <div className="flex items-center gap-1 text-sm mb-3">
                                            <span className="text-pink-400">#</span>
                                            <span className="text-gray-400">#{kw.keyword} 해시태그:</span>
                                            <span className="font-bold text-pink-400">
                                                {kw.hashtagCount.toLocaleString()}개 영상
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* 터진 영상 보기 버튼 */}
                                    {kw.hitVideoList && kw.hitVideoList.length > 0 && (
                                        <button
                                            onClick={() => setExpandedKeyword(expandedKeyword === index ? null : index)}
                                            className="text-sm text-primary hover:text-primary-hover flex items-center gap-1"
                                        >
                                            <Icon name={expandedKeyword === index ? "chevron-up" : "chevron-down"} size={14} />
                                            터진 영상 {kw.hitVideoList.length}개 {expandedKeyword === index ? '접기' : '보기'}
                                        </button>
                                    )}
                                </div>
                                
                                {/* 터진 영상 목록 (펼쳐짐) */}
                                {expandedKeyword === index && kw.hitVideoList && (
                                    <div className="border-t border-gray-700 bg-black/30 p-3 space-y-2">
                                        {kw.hitVideoList.map((vid, vidIndex) => (
                                            <a
                                                key={vidIndex}
                                                href={`https://www.youtube.com/watch?v=${vid.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 p-2 rounded hover:bg-gray-800 transition"
                                            >
                                                <img src={vid.thumbnail} className="w-16 h-10 rounded bg-gray-700 object-cover" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-white line-clamp-1">{vid.title}</div>
                                                    <div className="text-xs text-gray-500">{vid.channelTitle}</div>
                                                </div>
                                                <div className="text-sm font-bold text-red-400">
                                                    {(vid.viewCount / 10000).toFixed(0)}만
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* 하단 버튼 */}
            <div className="mt-6 flex justify-end gap-2">
                <button 
                    onClick={() => {
                        setIsKeywordModalOpen(false);
                        setManualScript('');
                        setUseManualScript(false);
                        setExtractedKeywords([]);
                        setKeywordTranscriptInfo(null);
                        setVideoType(null);
                        setVideoTypeMessage(null);
                        setExpandedKeyword(null);
                    }} 
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                    닫기
                </button>
                {extractedKeywords.length > 0 && (
                    <button 
                        onClick={saveKeywordsToSupabase}
                        disabled={isExtractingKeywords}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                        <Icon name="check" size={14} /> 키워드 저장
                    </button>
                )}
            </div>
        </div>
    </div>
)}



   
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(<App />);






















