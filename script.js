// 游戏配置
const config = {
    startValue: 1,  // 起点：1米
    endValue: 3,    // 终点：3米
    middleValue: 2, // 中点：2米
    segments: 20,   // 分成20段
    moleCount: 5,   // 同时出现的地鼠数量
    gameTime: 30,   // 每局时间（秒）
    minDistance: 0.15 // 地鼠之间的最小距离（米），一位小数精度下调整为0.15
};

// 游戏状态
let gameState = {
    score: 0,
    level: 1,       // 当前关卡（1或2）
    isPlaying: false,
    currentTarget: null,
    moles: [],      // 当前地鼠数组
    timer: null,    // 计时器
    timeLeft: config.gameTime,
    questionTimer: null,  // 题目倒计时器
    questionAnswered: false,  // 当前题目是否已回答
    hasEnteredLevel2: false  // 是否已进入第二关
};

// DOM 元素
const numberLine = document.getElementById('numberLine');
const clickableArea = document.getElementById('clickableArea');
const ticksContainer = document.getElementById('ticks');
const questionEl = document.getElementById('question');
const targetValueEl = document.getElementById('targetValue');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const timerEl = document.getElementById('timer');
const timerContainer = document.querySelector('.timer');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

// 音效系统（使用Web Audio API生成音效）
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine') {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// 播放"耶～"音效（上升音调）
function playYay() {
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
    frequencies.forEach((freq, index) => {
        setTimeout(() => {
            playSound(freq, 0.15, 'sine');
        }, index * 100);
    });
}

// 播放笑声（快速变化的音调）
function playLaugh() {
    const frequencies = [300, 250, 350, 280, 400, 320];
    frequencies.forEach((freq, index) => {
        setTimeout(() => {
            playSound(freq, 0.1, 'sawtooth');
        }, index * 80);
    });
}

// 播放打击音效（锤子敲击）
function playHit() {
    // 打击声：低频率快速衰减
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 150; // 低频率
    oscillator.type = 'sawtooth'; // 锯齿波更接近打击声
    
    // 快速衰减模拟打击效果
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.08);
    
    // 添加一个高频的"叮"声
    setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        
        osc2.frequency.value = 400;
        osc2.type = 'square';
        
        gain2.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
        
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.05);
    }, 20);
}

// 音效函数
const sounds = {
    correct: () => playYay(),                           // "耶～"音效
    incorrect: () => playLaugh(),                       // 笑声
    click: () => playHit(),                             // 打击音效
    tick: () => playSound(400, 0.1, 'sine'),            // 倒计时音
    gameOver: () => {
        playSound(200, 0.3, 'sawtooth');
        setTimeout(() => playSound(150, 0.5, 'sawtooth'), 300);
    }
};

// 初始化数轴
function initNumberLine() {
    const lineWidth = clickableArea.offsetWidth;
    const segmentWidth = lineWidth / config.segments;
    
    // 清除现有刻度
    ticksContainer.innerHTML = '';
    
    // 创建刻度线
    for (let i = 0; i <= config.segments; i++) {
        const tick = document.createElement('div');
        tick.className = 'tick';
        
        // 1米、2米、3米位置（i=0, 10, 20）- 红色加粗
        if (i === 0 || i === 10 || i === 20) {
            tick.classList.add('major', 'red-marker');
        }
        // 1.5米、2.5米位置（i=5, 15）- 粉红色
        else if (i === 5 || i === 15) {
            tick.classList.add('major', 'pink-marker');
        }
        // 其他每5个刻度一个主刻度（对应0.5米）
        else if (i % 5 === 0) {
            tick.classList.add('major');
        }
        
        tick.style.left = `${(i / config.segments) * 100}%`;
        ticksContainer.appendChild(tick);
    }
}

// 将数值转换为像素位置
function valueToPosition(value) {
    const lineWidth = clickableArea.offsetWidth;
    const range = config.endValue - config.startValue;
    const normalizedValue = (value - config.startValue) / range;
    return normalizedValue * lineWidth;
}

// 将像素位置转换为数值
function positionToValue(position) {
    const lineWidth = clickableArea.offsetWidth;
    const range = config.endValue - config.startValue;
    const normalizedPosition = position / lineWidth;
    return config.startValue + normalizedPosition * range;
}

// 生成随机目标值
function generateTarget() {
    // 生成1到3之间的随机一位小数
    const randomValue = config.startValue + 
        Math.random() * (config.endValue - config.startValue);
    return Math.round(randomValue * 10) / 10;
}

// 生成错误位置（确保与正确位置和其他地鼠有足够距离）
function generateWrongPositions(correctValue, existingPositions) {
    const wrongPositions = [];
    const attempts = 100; // 最多尝试次数
    
    for (let i = 0; i < config.moleCount - 1; i++) {
        let newValue;
        let valid = false;
        let attempt = 0;
        
        while (!valid && attempt < attempts) {
            newValue = generateTarget();
            
            // 检查与正确答案的距离
            if (Math.abs(newValue - correctValue) < config.minDistance) {
                attempt++;
                continue;
            }
            
            // 检查与已有位置的距离
            valid = true;
            for (const pos of [...existingPositions, ...wrongPositions]) {
                if (Math.abs(newValue - pos) < config.minDistance) {
                    valid = false;
                    break;
                }
            }
            
            attempt++;
        }
        
        if (valid) {
            wrongPositions.push(newValue);
        } else {
            // 如果无法生成有效位置，使用一个确保不重叠的值
            const fallbackValue = config.startValue + 
                (i + 1) * (config.endValue - config.startValue) / (config.moleCount + 1);
            wrongPositions.push(Math.round(fallbackValue * 10) / 10);
        }
    }
    
    return wrongPositions;
}

// 地鼠颜色数组
const moleColors = [
    { bg: '#FF6B6B', border: '#EE5A52' },  // 红色
    { bg: '#4ECDC4', border: '#2A9D8F' },  // 青色
    { bg: '#45B7D1', border: '#3498DB' },  // 蓝色
    { bg: '#FFA07A', border: '#FF8C69' },  // 橙色
    { bg: '#98D8C8', border: '#7FB3A3' }, // 薄荷绿
    { bg: '#F7DC6F', border: '#F4D03F' },  // 黄色
    { bg: '#BB8FCE', border: '#9B59B6' },  // 紫色
    { bg: '#85C1E2', border: '#5DADE2' },  // 天蓝色
    { bg: '#F8B88B', border: '#F5A623' },  // 浅橙色
    { bg: '#AED6F1', border: '#85C1E9' },  // 浅蓝色
    { bg: '#A9DFBF', border: '#7DCEA0' },  // 浅绿色
    { bg: '#FAD7A0', border: '#F8C471' },  // 浅黄色
    { bg: '#D7BDE2', border: '#BB8FCE' },  // 浅紫色
    { bg: '#F1948A', border: '#EC7063' },  // 粉红色
    { bg: '#82E0AA', border: '#58D68D' }   // 绿色
];

// 创建地鼠元素
function createMole(value, isCorrect) {
    const mole = document.createElement('div');
    mole.className = 'mole';
    
    mole.dataset.value = value;
    mole.dataset.isCorrect = isCorrect;
    
    const position = valueToPosition(value);
    mole.style.left = `${position}px`;
    
    // 随机选择颜色
    const colorIndex = Math.floor(Math.random() * moleColors.length);
    const colors = moleColors[colorIndex];
    
    // 创建地鼠身体
    const body = document.createElement('div');
    body.className = 'mole-body';
    body.style.background = colors.bg;
    body.style.borderColor = colors.border;
    
    // 创建地鼠脸部
    const face = document.createElement('div');
    face.className = 'mole-face';
    
    const eyeLeft = document.createElement('div');
    eyeLeft.className = 'mole-eye left';
    const eyeRight = document.createElement('div');
    eyeRight.className = 'mole-eye right';
    const nose = document.createElement('div');
    nose.className = 'mole-nose';
    
    face.appendChild(eyeLeft);
    face.appendChild(eyeRight);
    face.appendChild(nose);
    body.appendChild(face);
    mole.appendChild(body);
    
    return mole;
}

// 显示地鼠
function showMoles() {
    // 清除之前的地鼠和题目计时器
    clearMoles();
    clearQuestionTimer();
    
    // 重置题目回答状态
    gameState.questionAnswered = false;
    
    // 生成正确答案
    const correctValue = generateTarget();
    gameState.currentTarget = correctValue;
    targetValueEl.textContent = correctValue.toFixed(1);
    
    // 生成错误位置
    const wrongValues = generateWrongPositions(correctValue, [correctValue]);
    
    // 创建所有位置数组并打乱
    const allValues = [correctValue, ...wrongValues];
    for (let i = allValues.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allValues[i], allValues[j]] = [allValues[j], allValues[i]];
    }
    
    // 创建地鼠
    allValues.forEach((value, index) => {
        const isCorrect = Math.abs(value - correctValue) < 0.05; // 一位小数的容差
        const mole = createMole(value, isCorrect);
        clickableArea.appendChild(mole);
        gameState.moles.push(mole);
    });
    
    // 根据关卡设置不同的思考时间（第一关3秒，第二关2秒）
    const thinkTime = gameState.level === 1 ? 3000 : 2000;
    
    // 启动倒计时，如果超时未回答则扣分
    gameState.questionTimer = setTimeout(() => {
        if (!gameState.questionAnswered && gameState.isPlaying) {
            // 超时未回答，随机扣分
            const penalty = Math.floor(Math.random() * 10) + 1; // 1-10的随机扣分
            gameState.score -= penalty;
            feedbackEl.textContent = `⏱ 超时未回答！-${penalty}分`;
            feedbackEl.className = 'feedback incorrect';
            scoreEl.textContent = gameState.score;
            
            // 检查是否进入第二关
            checkLevelUp();
            
            // 清除所有地鼠并生成新的
            clearMoles();
            if (gameState.isPlaying) {
                setTimeout(() => {
                    showMoles();
                    feedbackEl.textContent = '';
                    feedbackEl.className = 'feedback';
                }, 100);
            }
        }
    }, thinkTime);
}

// 清除所有地鼠
function clearMoles() {
    gameState.moles.forEach(mole => mole.remove());
    gameState.moles = [];
}

// 清除题目计时器
function clearQuestionTimer() {
    if (gameState.questionTimer) {
        clearTimeout(gameState.questionTimer);
        gameState.questionTimer = null;
    }
}

// 检查并进入第二关
function checkLevelUp() {
    // 如果分数达到30分且还在第一关，则进入第二关
    if (gameState.score >= 30 && gameState.level === 1 && !gameState.hasEnteredLevel2) {
        gameState.level = 2;
        gameState.hasEnteredLevel2 = true;
        levelEl.textContent = '2';
        
        // 显示恭喜提示和氛围画面
        showLevel2Celebration();
    }
}

// 显示进入第二关的恭喜提示和氛围画面
function showLevel2Celebration() {
    // 创建庆祝遮罩层
    const celebrationOverlay = document.createElement('div');
    celebrationOverlay.className = 'celebration-overlay';
    document.body.appendChild(celebrationOverlay);
    
    // 创建恭喜文字
    const congratsText = document.createElement('div');
    congratsText.className = 'congrats-text';
    congratsText.innerHTML = `
        <div class="congrats-title">🎉 恭喜！🎉</div>
        <div class="congrats-message">总分突破30分，恭喜进入第二关！</div>
        <div class="congrats-subtitle">第二关思考时间缩短为2秒，加油！</div>
    `;
    celebrationOverlay.appendChild(congratsText);
    
    // 播放庆祝音效（使用已有的correct音效）
    sounds.correct();
    setTimeout(() => sounds.correct(), 200);
    setTimeout(() => sounds.correct(), 400);
    
    // 2秒后移除庆祝画面
    setTimeout(() => {
        celebrationOverlay.remove();
    }, 2000);
}

// 创建星星元素
function createStar(position) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = `${position}px`;
    
    // 添加闪烁效果
    for (let i = 0; i < 4; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'star-sparkle';
        star.appendChild(sparkle);
    }
    
    return star;
}

// 处理地鼠点击
function handleMoleClick(mole) {
    if (!gameState.isPlaying) return;
    
    // 标记题目已回答，清除题目计时器
    gameState.questionAnswered = true;
    clearQuestionTimer();
    
    const isCorrect = mole.dataset.isCorrect === 'true';
    const moleValue = parseFloat(mole.dataset.value);
    
    // 播放点击音
    sounds.click();
    
    if (isCorrect) {
        // 正确答案 - 地鼠变成星星
        const position = valueToPosition(moleValue);
        mole.style.opacity = '0';
        
        // 创建星星
        const star = createStar(position);
        clickableArea.appendChild(star);
        
        // 播放"耶～"音效
        sounds.correct();
        
        // 更新分数和反馈
        const points = Math.floor(Math.random() * 10) + 1; // 1-10的随机分数
        gameState.score += points;
        feedbackEl.textContent = `✓ 正确！+${points}分`;
        feedbackEl.className = 'feedback correct';
        scoreEl.textContent = gameState.score;
        
        // 检查是否进入第二关
        checkLevelUp();
        
        // 延迟后清除所有元素并生成新的
        setTimeout(() => {
            star.remove();
            clearMoles();
            if (gameState.isPlaying) {
                setTimeout(() => {
                    showMoles();
                    feedbackEl.textContent = '';
                    feedbackEl.className = 'feedback';
                }, 100);
            }
        }, 600);
    } else {
        // 错误答案 - 地鼠哈哈大笑
        mole.classList.add('laughing');
        
        // 播放笑声
        sounds.incorrect();
        
        // 更新分数和反馈
        const penalty = Math.floor(Math.random() * 10) + 1; // 1-10的随机扣分
        gameState.score -= penalty; // 允许分数为负数
        const diff = Math.abs(moleValue - gameState.currentTarget).toFixed(2);
        feedbackEl.textContent = `✗ 错误！相差 ${diff} 米，-${penalty}分`;
        feedbackEl.className = 'feedback incorrect';
        scoreEl.textContent = gameState.score;
        
        // 检查是否进入第二关（虽然扣分，但总分可能已经达到30分）
        checkLevelUp();
        
        // 延迟后清除所有地鼠并生成新的
        setTimeout(() => {
            clearMoles();
            if (gameState.isPlaying) {
                setTimeout(() => {
                    showMoles();
                    feedbackEl.textContent = '';
                    feedbackEl.className = 'feedback';
                }, 100);
            }
        }, 600);
    }
}

// 开始计时器
function startTimer() {
    gameState.timeLeft = config.gameTime;
    timerEl.textContent = gameState.timeLeft;
    timerContainer.classList.remove('warning');
    
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        timerEl.textContent = gameState.timeLeft;
        
        // 最后5秒警告
        if (gameState.timeLeft <= 5) {
            timerContainer.classList.add('warning');
            if (gameState.timeLeft > 0) {
                sounds.tick();
            }
        }
        
        if (gameState.timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

// 停止计时器
function stopTimer() {
    if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null;
    }
}

// 显示结算画面
function showGameOverScreen(score) {
    // 创建结算遮罩层
    const gameOverOverlay = document.createElement('div');
    gameOverOverlay.className = 'game-over-overlay';
    document.body.appendChild(gameOverOverlay);
    
    // 根据分数确定显示内容
    let title, message, emoji, className;
    
    if (score <= 0) {
        // 哭泣画面
        title = '😢 游戏结束';
        message = '不要灰心，继续努力！';
        emoji = '😢';
        className = 'game-over-cry';
    } else if (score > 0 && score <= 10) {
        // 继续加油
        title = '游戏结束';
        message = '继续加油哦！';
        emoji = '💪';
        className = 'game-over-encourage';
    } else if (score > 10 && score <= 30) {
        // 棒棒哒
        title = '游戏结束';
        message = '棒棒哒！';
        emoji = '👍';
        className = 'game-over-good';
    } else {
        // 天才
        title = '游戏结束';
        message = '你莫非是天才！';
        emoji = '🌟';
        className = 'game-over-genius';
    }
    
    // 创建结算内容
    const gameOverContent = document.createElement('div');
    gameOverContent.className = `game-over-content ${className}`;
    gameOverContent.innerHTML = `
        <div class="game-over-emoji">${emoji}</div>
        <div class="game-over-title">${title}</div>
        <div class="game-over-score">最终得分：${score}分</div>
        <div class="game-over-message">${message}</div>
        <button class="btn-close-result" onclick="this.closest('.game-over-overlay').remove()">关闭</button>
    `;
    gameOverOverlay.appendChild(gameOverContent);
    
    // 根据分数播放不同的音效
    if (score <= 0) {
        // 播放低沉的音效
        playSound(150, 0.5, 'sawtooth');
    } else if (score > 30) {
        // 播放庆祝音效
        sounds.correct();
        setTimeout(() => sounds.correct(), 200);
    }
}

// 结束游戏
function endGame() {
    gameState.isPlaying = false;
    stopTimer();
    clearQuestionTimer();
    clearMoles();
    sounds.gameOver();
    
    startBtn.disabled = false;
    startBtn.textContent = '开始游戏';
    
    // 显示结算画面
    setTimeout(() => {
        showGameOverScreen(gameState.score);
    }, 500);
}

// 开始游戏
startBtn.addEventListener('click', () => {
    // 激活音频上下文（某些浏览器需要用户交互）
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    gameState.isPlaying = true;
    gameState.score = 0;
    gameState.level = 1;
    gameState.hasEnteredLevel2 = false;
    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    
    startBtn.disabled = true;
    startBtn.textContent = '游戏中...';
    
    // 开始计时器
    startTimer();
    
    // 显示第一组地鼠
    showMoles();
});

// 重新开始
resetBtn.addEventListener('click', () => {
    gameState.isPlaying = false;
    gameState.score = 0;
    gameState.level = 1;
    gameState.hasEnteredLevel2 = false;
    gameState.timeLeft = config.gameTime;
    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    timerEl.textContent = config.gameTime;
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    timerContainer.classList.remove('warning');
    
    stopTimer();
    clearQuestionTimer();
    clearMoles();
    
    startBtn.disabled = false;
    startBtn.textContent = '开始游戏';
    
    targetValueEl.textContent = '?';
});

// 处理地鼠点击事件（事件委托）
clickableArea.addEventListener('click', (e) => {
    if (!gameState.isPlaying) return;
    
    const mole = e.target.closest('.mole');
    if (mole && !mole.classList.contains('hit')) {
        handleMoleClick(mole);
    }
});

// 窗口大小改变时重新初始化
window.addEventListener('resize', () => {
    if (gameState.isPlaying && gameState.moles.length > 0) {
        showMoles();
    }
    initNumberLine();
});

// 初始化
initNumberLine();
