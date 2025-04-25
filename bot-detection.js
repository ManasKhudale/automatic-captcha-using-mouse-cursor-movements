// BotDetector with enhanced movement analysis and robust bot detection
class BotDetector {
  constructor() {
    // Security Configuration
    this.CRYPTO_KEY = "SAMPLE_KEY"; // 32-byte AES key (must match backend)
    
    // Behavior Tracking
    this.hasMovement = false;
    this.movementThreshold = 10; // pixels required before click
    this.movementDistance = 0;
    this.cursorData = [];
    
    // State Flags
    this.earlyDetectionDone = false;
    this.isBot = false;
    this.firstInteraction = false;
    
    // Configuration
    this.apiEndpoint = "http://localhost:5000/predict";
    this.movementDebounce = null;
    this.debounceTime = 1000; // ms
    
    // Initialize
    document.body.classList.add('cursor-hidden');
    this.setupEventListeners();
    this.interceptClicks();
    setTimeout(() => this.performEarlyDetection(), 100);
    
    console.log('BotDetector initialized with recent movement analysis');
  }

  setupEventListeners() {
    document.addEventListener("mousemove", (event) => this.trackMovement(event, "Move"));
    document.addEventListener("mousedown", (event) => this.trackMovement(event, "Pressed"));
    document.addEventListener("mouseup", (event) => this.trackMovement(event, "Released"));
    document.addEventListener("touchstart", () => this.handleFirstInteraction());
  }

  trackMovement(event, state) {
    // Handle first interaction
    if (!this.firstInteraction) {
      this.handleFirstInteraction();
    }
    
    // Reset debounce timer
    clearTimeout(this.movementDebounce);
    this.movementDebounce = setTimeout(() => {
      this.hasMovement = false;
      this.movementDistance = 0;
    }, this.debounceTime);

    // Track movement distance
    if (state === "Move") {
      this.movementDistance += Math.sqrt(
        Math.pow(event.movementX, 2) + 
        Math.pow(event.movementY, 2)
      );
      this.hasMovement = this.movementDistance > this.movementThreshold;
    }

    // Skip if bot already detected
    if (this.isBot) return;

    // Record cursor data
    const recordTimestamp = Date.now() / 1000;
    const clientTimestamp = performance.now() / 1000;
    const dataPoint = {
      recordTimestamp,
      clientTimestamp,
      button: this.getButtonType(event, state),
      state,
      x: event.clientX,
      y: event.clientY
    };
    
    this.cursorData.push(dataPoint);
    
    // Limit data size
    if (this.cursorData.length > 200) {
      this.cursorData = this.cursorData.slice(-100);
    }
    
    // Log inputs after every button click
    if (state === "Pressed") {
      this.logModelInputs();
    }
  }

  // Check if last 10 movements have any coordinate changes
  recentMovementsHaveChanged() {
    if (this.cursorData.length < 10) return false;
    
    // Get last 10 movement entries
    const recent = this.cursorData.slice(-10).filter(item => item.state === "Move");
    if (recent.length < 2) return false;
    
    // Check if there are any position changes
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].x !== recent[i-1].x || recent[i].y !== recent[i-1].y) {
        return true;
      }
    }
    return false;
  }

  interceptClicks() {
    document.addEventListener('mousedown', (event) => {
      // Log model inputs on every click
      this.logModelInputs();
      
      if (this.shouldBlockClick(event)) {
        console.log("Blocking click - Bot detection triggered:", {
          hasMovement: this.hasMovement,
          movementDistance: this.movementDistance,
          recentChanges: this.recentMovementsHaveChanged(),
          isTrusted: event.isTrusted,
          elementType: event.target.tagName
        });
        this.handleBotDetection(event);
      }
    }, { capture: true });
  }

  logModelInputs() {
    console.group("Bot Detection Model Inputs");
    console.log("Timestamp:", new Date().toISOString());
    
    // Basic metrics
    console.log("Total movement distance:", this.movementDistance.toFixed(2) + "px");
    console.log("Has sufficient movement:", this.hasMovement);
    console.log("Recent movements changed:", this.recentMovementsHaveChanged());
    
    // Calculate some derived metrics if we have enough data points
    if (this.cursorData.length >= 2) {
      const recentData = this.cursorData.slice(-10);
      
      // Calculate average velocity
      let totalVelocity = 0;
      for (let i = 1; i < recentData.length; i++) {
        const timeDiff = recentData[i].clientTimestamp - recentData[i-1].clientTimestamp;
        if (timeDiff > 0) {
          const distance = Math.sqrt(
            Math.pow(recentData[i].x - recentData[i-1].x, 2) + 
            Math.pow(recentData[i].y - recentData[i-1].y, 2)
          );
          totalVelocity += distance / timeDiff;
        }
      }
      const avgVelocity = totalVelocity / (recentData.length - 1);
      console.log("Average velocity:", avgVelocity.toFixed(2) + "px/s");
      
      // Time since first interaction
      if (this.cursorData.length > 0) {
        const firstTimestamp = this.cursorData[0].clientTimestamp;
        const lastTimestamp = this.cursorData[this.cursorData.length-1].clientTimestamp;
        console.log("Session duration:", (lastTimestamp - firstTimestamp).toFixed(2) + "s");
      }
    }
    
    // Log the raw data points
    console.log("Last 10 movement records:");
    const recentData = this.cursorData.slice(-10);
    console.table(recentData.map(point => ({
      recordTimestamp: point.recordTimestamp.toFixed(3),
      clientTimestamp: point.clientTimestamp.toFixed(3),
      button: point.button,
      state: point.state,
      x: Math.round(point.x),
      y: Math.round(point.y)
    })));
    
    console.groupEnd();
  }

  shouldBlockClick(event) {
    // Bot criteria: 
    // 1. No movement before click OR
    // 2. No changes in last 10 movements
    const suspiciousMovement = !this.hasMovement || !this.recentMovementsHaveChanged();
    
    return (
      !this.isBot && 
      suspiciousMovement &&
      this.isImportantElement(event.target)
    );
  }

  isImportantElement(element) {
    return (
      element.tagName === 'BUTTON' ||
      element.tagName === 'A' ||
      element.tagName === 'INPUT' ||
      !!element.onclick
    );
  }

  handleFirstInteraction() {
    if (!this.firstInteraction) {
      document.body.classList.remove('cursor-hidden');
      document.body.classList.add('cursor-visible');
      this.firstInteraction = true;
    }
  }

  handleBotDetection(event) {
    console.warn('Bot detected: Suspicious cursor movement pattern');
    this.isBot = true;
    
    // Save detection data for analysis
    const detectionData = {
      timestamp: Date.now(),
      cursorData: this.cursorData.slice(-20), // Last 20 movements
      reason: !this.hasMovement ? 'no_movement' : 'static_movements'
    };
    localStorage.setItem('bot_detection_data', JSON.stringify(detectionData));
    
    event.preventDefault();
    event.stopImmediatePropagation();
    this.blockWebsite();
  }

  async performEarlyDetection() {
    if (this.earlyDetectionDone || this.isBot) return;
    
    // Wait for minimum data points
    if (this.cursorData.length < 50) {
      setTimeout(() => this.performEarlyDetection(), 1000);
      return;
    }
    
    const isBot = await this.checkIsBot(true);
    if (isBot) this.handleBotDetection(new Event('programmatic'));
    this.earlyDetectionDone = true;
  }

  blockWebsite() {
    document.body.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;
      background:white;z-index:9999;display:flex;justify-content:center;
      align-items:center;flex-direction:column;">
        <h1 style="color:red;">Access Denied</h1>
        <p>Unnatural interaction detected. Please contact support.</p>
        <p style="color:#999;font-size:12px;">Detection ID: ${Date.now()}</p>
      </div>
    `;
    document.body.style.overflow = 'hidden';
  }

  async encryptData(data) {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(16));
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(this.CRYPTO_KEY),
        { name: 'AES-CBC' },
        false,
        ['encrypt']
      );
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        key,
        new TextEncoder().encode(JSON.stringify(data))
      );
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error("Encryption failed:", error);
      throw error;
    }
  }

  async checkIsBot(earlyDetection = false) {
    if (this.isBot) return true;
    if (this.cursorData.length < 10) return false; // Need enough data points

    try {
      // Format data for ML model - using camelCase keys to match backend expectations
      const dataForModel = this.formatDataForModel();
      
      const payloadData = {
        cursorData: dataForModel,
        earlyDetection,
        timestamp: Date.now()
      };
      
      // Try sending as JSON first for development/debugging
      try {
        const response = await fetch(this.apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payloadData)
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log("Bot detection result:", result);
          return result.prediction === 1;
        }
        
        // If JSON fails, fall back to encrypted
        console.log("Falling back to encrypted data");
      } catch (e) {
        console.log("JSON request failed, trying encryption", e);
      }
      
      // Encrypt and send
      const encryptedData = await this.encryptData(payloadData);

      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Encrypted": "AES-CBC"
        },
        body: encryptedData
      });

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const result = await response.json();
      console.log("Bot detection result (encrypted):", result);
      return result.prediction === 1;
    } catch (error) {
      console.error("Bot detection failed:", error);
      return false;
    }
  }

  formatDataForModel() {
    return this.cursorData.map(point => ({
      recordTimestamp: point.recordTimestamp,
      clientTimestamp: point.clientTimestamp,
      button: point.button,
      state: point.state,
      x: point.x,
      y: point.y
    }));
  }

  getButtonType(event, state) {
    if (state === "Move") return event.buttons === 1 ? "Left" : event.buttons === 2 ? "Right" : "NoButton";
    if (state === "Pressed") return event.button === 0 ? "Left" : event.button === 2 ? "Right" : "NoButton";
    return "NoButton";
  }
  
  // Additional detection methods from other examples
  detectBrowserInconsistencies() {
    const detectors = {
      webDriver: navigator.webdriver, // Checks if browser is controlled by automation
      headlessBrowser: navigator.userAgent.includes("Headless"), // Detects headless browsers
      noLanguages: (navigator.languages?.length || 0) === 0, // Checks if no languages are set
      inconsistentEval: this.detectInconsistentEval(), // Check for inconsistent eval lengths
      domManipulation: document.documentElement
        .getAttributeNames()
        .some((attr) => ["selenium", "webdriver", "driver"].includes(attr)) // Looks for automation attributes
    };
    
    // Check if any detector found something suspicious
    return Object.values(detectors).some(value => value === true);
  }
  
  detectInconsistentEval() {
    let length = eval.toString().length;
    let userAgent = navigator.userAgent.toLowerCase();
    let browser;
    
    if (userAgent.indexOf("edg/") !== -1) {
      browser = "edge";
    } else if (userAgent.indexOf("firefox") !== -1) {
      browser = "firefox";
    } else if (userAgent.indexOf("chrome") !== -1) {
      browser = "chrome";
    } else if (userAgent.indexOf("safari") !== -1) {
      browser = "safari";
    } else {
      browser = "unknown";
    }
    
    if (browser === "unknown") return false;
    
    return (
      (length === 33 && !["chrome", "opera", "edge"].includes(browser)) ||
      (length === 37 && !["firefox", "safari"].includes(browser))
    );
  }
}

// Initialize
if (typeof window !== 'undefined' && window.crypto?.subtle) {
  window.BotDetector = new BotDetector();
} else {
  console.error("Browser lacks required crypto support");
}
