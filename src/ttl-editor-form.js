
const LOGGING = {
  enabled: typeof localStorage !== 'undefined'
    ? localStorage.getItem('ttoys:log-ttl-editor-form') !== 'false'
    : true,
  marker: 'Ͳ FOR:',

  log(action, data) {
    if (!this.enabled) return;
    console.log(this.marker, JSON.stringify({
      action,
      timestamp: Date.now(),
      ...data
    }));
  },

  warn(action, data) {
    if (!this.enabled) return;
    console.warn(this.marker, JSON.stringify({
      action,
      timestamp: Date.now(),
      ...data
    }));
  },

  error(action, data) {
    console.error(this.marker, JSON.stringify({
      action,
      timestamp: Date.now(),
      ...data
    }));
  }
};
LOGGING.log('🔧 [TTL-EDITOR] Starting module...');
LOGGING.enabled = false;
// CRITICAL: Import N3 from CDN for browser compatibility
import * as N3 from 'n3';
LOGGING.log('✅ [TTL-EDITOR] N3 imported:', !!N3);


// NO STATIC IMPORT of mntl-space-fab - we'll load it dynamically
LOGGING.log('🔧 [TTL-EDITOR] Will load mntl-space-fab dynamically when needed');

// Default accepted types - full range of mental spaces
const DEFAULT_ACCEPTED_TYPES = [
  { 
    value: 'mntl:mmry', 
    label: 'mntl:mmry',
    description: 'mntl:mmry - Ephemeral memory space (session-only)' 
  },
  { 
    value: 'mntl:lock', 
    label: 'mntl:lock/{identity}',
    description: 'mntl:lock - Private, only you can see' 
  },
  { 
    value: 'mntl:gate', 
    label: 'mntl:gate/{identity}',
    description: 'mntl:gate - Gated, controlled access' 
  },
  { 
    value: 'mntl:open', 
    label: 'mntl:open/{identity}',
    description: 'mntl:open - Owned by you, readable by the world' 
  },
  { 
    value: 'mntl:publ', 
    label: 'mntl:publ',
    description: 'mntl:publ - A true public commons' 
  }
];

LOGGING.log('🔧 [TTL-EDITOR] Defining component class...');

class TTLEditorFormWC extends HTMLElement {
  constructor() {
    super();
    LOGGING.log('🏗️ [TTL-EDITOR] Constructor called');
    this.attachShadow({ mode: 'open' });
    LOGGING.log('✅ [TTL-EDITOR] Shadow DOM attached');
    
    // State
    this._mmmServer = null;
    this._currentIdentity = null;
    this._defaultGraph = 'mntl:publ/imported';
    this._acceptedTypes = [...DEFAULT_ACCEPTED_TYPES];
    this._mntlSpaceFabLoaded = false;
    
    // AI attribution support
    this._aiAttribution = null;      // e.g., "llm:ollama/mistral:7b"
    this._contentModifiedByUser = false;  // Tracks if user has edited AI-generated content
    this._originalAiContent = null;  // Original AI content for comparison
    
    this.ttlContent = '';
    this.isValid = false;
    this.validationError = null;
    this.tripleCount = 0;
    
    this._updateTimer = null;
    LOGGING.log('✅ [TTL-EDITOR] State initialized');
  }
  
  get mmmServer() { return this._mmmServer; }
  set mmmServer(value) { this._mmmServer = value; }
  
  get currentIdentity() { return this._currentIdentity; }
  set currentIdentity(value) {
    LOGGING.log('🔧 [TTL-EDITOR] Setting currentIdentity:', value);
    this._currentIdentity = value;
    this.updateAttribution();
    this.updateFab();
  }
  
  get defaultGraph() { return this._defaultGraph; }
  set defaultGraph(value) {
    LOGGING.log('🔧 [TTL-EDITOR] Setting defaultGraph:', value);
    this._defaultGraph = value;
    this.updateFab();
  }
  
  get acceptedTypes() { return this._acceptedTypes; }
  set acceptedTypes(types) {
    if (Array.isArray(types) && types.length > 0) {
      LOGGING.log('🔧 [TTL-EDITOR] Setting acceptedTypes:', types.length, 'types');
      this._acceptedTypes = types;
      this.updateFab();
    }
  }
  
  /**
   * AI Attribution - when set, submissions will use this identity
   * unless the user modifies the content
   */
  get aiAttribution() { return this._aiAttribution; }
  set aiAttribution(value) {
    LOGGING.log('🤖 [TTL-EDITOR] Setting aiAttribution:', value);
    this._aiAttribution = value;
    this._contentModifiedByUser = false;
    this.updateAttribution();
  }
  
  /**
   * Get the effective "by" identity for submission
   * Returns AI attribution if set and content unmodified, otherwise current user
   */
  get effectiveBy() {
    if (this._aiAttribution && !this._contentModifiedByUser) {
      return this._aiAttribution;
    }
    // If currentIdentity not set, try to discover it
    if (!this._currentIdentity) {
      this._currentIdentity = this.discoverIdentity();
    }
    return this._currentIdentity;
  }
  
  /**
   * Try to discover current user identity from various sources
   */
  discoverIdentity() {
    // Try window.noosclient
    if (window.noosclient?.currentIdentity) {
      return window.noosclient.currentIdentity;
    }
    
    // Try window.currentIdentity
    if (window.currentIdentity) {
      return window.currentIdentity;
    }
    
    // Try localStorage
    try {
      const stored = localStorage.getItem('mmm:identity');
      if (stored) return stored;
    } catch (e) {
      // localStorage not available
    }
    
    // Try JWT token parsing
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.sub || payload.email) {
          return payload.sub || `mailto:${payload.email}`;
        }
      }
    } catch (e) {
      // Token parsing failed
    }
    
    return null;
  }
  
  /**
   * Programmatically set content (e.g., from AI generation)
   * Resets the modified flag so AI attribution applies
   */
  setContent(ttl) {
    LOGGING.log('📝 [TTL-EDITOR] setContent() called');
    this.ttlContent = ttl;
    this._originalAiContent = ttl;
    this._contentModifiedByUser = false;
    
    const textarea = this.shadowRoot.getElementById('ttl-input');
    if (textarea) {
      textarea.value = ttl;
    }
    
    this.validateTTL();
    this.updateSubmitButton();
    this.updateAttribution();
  }
  
  async connectedCallback() {
    LOGGING.log('🔌 [TTL-EDITOR] connectedCallback - component added to DOM');
    
    try {
      // Try to discover identity if not already set
      if (!this._currentIdentity) {
        this._currentIdentity = this.discoverIdentity();
        if (this._currentIdentity) {
          LOGGING.log('🔍 [TTL-EDITOR] Discovered identity:', this._currentIdentity);
        }
      }
      
      // CRITICAL: Load mntl-space-fab dynamically (matching quad-form pattern)
      await this.loadMntlSpaceFab();
      
      LOGGING.log('🎨 [TTL-EDITOR] Calling render()...');
      this.render();
      LOGGING.log('✅ [TTL-EDITOR] render() completed');
      
      LOGGING.log('🎛️ [TTL-EDITOR] Calling setupFab()...');
      this.setupFab();
      LOGGING.log('✅ [TTL-EDITOR] setupFab() completed');
      
      LOGGING.log('🔗 [TTL-EDITOR] Calling attachEventListeners()...');
      this.attachEventListeners();
      LOGGING.log('✅ [TTL-EDITOR] attachEventListeners() completed');
      
      LOGGING.log('⏰ [TTL-EDITOR] Calling updateAttribution()...');
      this.updateAttribution();
      LOGGING.log('✅ [TTL-EDITOR] updateAttribution() completed');
      
      this._updateTimer = setInterval(() => this.updateAttribution(), 1000);
      LOGGING.log('✅ [TTL-EDITOR] Update timer started');
    } catch (error) {
      LOGGING.error('❌ [TTL-EDITOR] Error in connectedCallback:', error);
    }
  }
  
  async loadMntlSpaceFab() {
    LOGGING.log('📦 [TTL-EDITOR] loadMntlSpaceFab() starting...');
    
    // Check if already loaded
    if (customElements.get('mntl-space-fab')) {
      LOGGING.log('✅ [TTL-EDITOR] mntl-space-fab already registered');
      this._mntlSpaceFabLoaded = true;
      return;
    }
    
    // Try to dynamically load it from the server route
    try {
      LOGGING.log('🔄 [TTL-EDITOR] Attempting to load mntl-space-fab from /mntl-space-fab/src/mntl-space-fab.js');
      await import('/mntl-space-fab/src/mntl-space-fab.js');
      LOGGING.log('✅ [TTL-EDITOR] Successfully loaded mntl-space-fab');
      this._mntlSpaceFabLoaded = true;
    } catch (err) {
      LOGGING.error('❌ [TTL-EDITOR] Failed to load mntl-space-fab:', err);
      throw new Error('Required component mntl-space-fab failed to load');
    }
  }
  
  disconnectedCallback() {
    LOGGING.log('🔌 [TTL-EDITOR] disconnectedCallback - component removed from DOM');
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
    }
  }
  
  render() {
    LOGGING.log('🎨 [TTL-EDITOR] render() starting...');
    const identity = this._currentIdentity || 'not logged in';
    const isAuthenticated = !!this._currentIdentity;
    LOGGING.log('🎨 [TTL-EDITOR] identity:', identity, 'isAuthenticated:', isAuthenticated);
    
    const html = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .form-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #dee2e6;
        }
        
        .attribution {
          display: flex;
          gap: 30px;
          font-size: 14px;
        }
        
        .attr-item {
          display: flex;
          gap: 8px;
        }
        
        .attr-label {
          font-weight: 600;
          color: #6c757d;
        }
        
        .attr-value {
          font-family: 'Monaco', monospace;
          font-weight: 500;
        }
        
        .attr-value.authenticated {
          color: #28a745;
        }
        
        .attr-value.not-authenticated {
          color: #dc3545;
        }
        
        .attr-value.ai-source {
          color: #6f42c1;
        }
        
        .ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #e9d5ff;
          color: #6f42c1;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          margin-left: 8px;
        }
        
        .ai-badge.modified {
          background: #fef3c7;
          color: #92400e;
        }
        
        .section {
          margin-bottom: 20px;
        }
        
        .section-label {
          display: block;
          font-weight: 600;
          margin-bottom: 10px;
          color: #495057;
          font-size: 15px;
        }
        
        .ttl-textarea {
          width: 100%;
          min-height: 400px;
          padding: 15px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
          border: 2px solid #ced4da;
          border-radius: 6px;
          resize: vertical;
          box-sizing: border-box;
          background: #ffffff;
          display: block;
        }
        
        .ttl-textarea:focus {
          outline: none;
          border-color: #80bdff;
          box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }
        
        .ttl-textarea.invalid {
          border-color: #dc3545;
          background: #fff5f5;
        }
        
        .ttl-textarea.valid {
          border-color: #28a745;
        }
        
        .ttl-textarea.ai-generated {
          border-color: #6f42c1;
        }
        
        .validation-status {
          margin-top: 10px;
          padding: 12px;
          border-radius: 6px;
          font-size: 14px;
        }
        
        .validation-status.valid {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
        }
        
        .validation-status.invalid {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
        }
        
        .validation-status.empty {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          color: #856404;
        }
        
        .error-message {
          font-family: 'Monaco', monospace;
          font-size: 12px;
          margin-top: 8px;
          white-space: pre-wrap;
        }
        
        .submit-section {
          display: flex;
          justify-content: flex-end;
          gap: 15px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
        }
        
        .btn {
          padding: 12px 30px;
          border: none;
          border-radius: 6px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-primary {
          background: #007bff;
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        .btn-primary:disabled {
          background: #6c757d;
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        
        .btn-secondary:hover {
          background: #545b62;
        }
      </style>
      
      <div class="form-container">
        <div class="header">
          <h2 style="margin: 0; color: #343a40;">Ͳ Turtle Editor</h2>
          <div class="attribution">
            <div class="attr-item">
              <span class="attr-label">at:</span>
              <span class="attr-value" id="at-value">--</span>
            </div>
            <div class="attr-item">
              <span class="attr-label">by:</span>
              <span class="attr-value" id="by-value">${identity}</span>
              <span class="ai-badge" id="ai-badge" style="display: none;">🤖 AI</span>
            </div>
          </div>
        </div>
        
        <div class="section">
          <label class="section-label">Turtle (TTL) Content</label>
          <textarea 
            class="ttl-textarea" 
            id="ttl-input"
            placeholder="@prefix ex: <http://example.org/> .

ex:Alice ex:knows ex:Bob .
ex:Bob ex:age 42 .
ex:Charlie a ex:Person ;
    ex:name &quot;Charlie&quot;@en ."
            spellcheck="false"
          ></textarea>
          <div id="validation-status" class="validation-status empty">
            ⚠️ Enter some Turtle content to begin
          </div>
        </div>
        
        <div class="section">
          <label class="section-label">Target Graph</label>
          <mntl-space-fab id="graph-fab"></mntl-space-fab>
        </div>
        
        <div class="submit-section">
          <button type="button" class="btn btn-secondary" id="clear-btn">Clear</button>
          <button type="button" class="btn btn-primary" id="submit-btn" disabled>
            Submit Turtle
          </button>
        </div>
      </div>
    `;
    
    LOGGING.log('🎨 [TTL-EDITOR] Setting shadowRoot.innerHTML (length:', html.length, ')');
    this.shadowRoot.innerHTML = html;
    LOGGING.log('✅ [TTL-EDITOR] shadowRoot.innerHTML set');
    
    // Verify elements exist
    const container = this.shadowRoot.querySelector('.form-container');
    const textarea = this.shadowRoot.getElementById('ttl-input');
    const fab = this.shadowRoot.getElementById('graph-fab');
    LOGGING.log('🔍 [TTL-EDITOR] Elements check:');
    LOGGING.log('  - .form-container:', !!container);
    LOGGING.log('  - #ttl-input:', !!textarea);
    LOGGING.log('  - #graph-fab:', !!fab);
  }
  
  setupFab() {
    LOGGING.log('🎛️ [TTL-EDITOR] setupFab() starting...');
    
    const fab = this.shadowRoot.getElementById('graph-fab');
    LOGGING.log('🎛️ [TTL-EDITOR] fab element:', !!fab);
    
    if (fab) {
      LOGGING.log('🎛️ [TTL-EDITOR] Setting fab properties...');
      fab.currentIdentity = this._currentIdentity;
      LOGGING.log('  - currentIdentity set:', this._currentIdentity);
      
      fab.acceptedTypes = this._acceptedTypes;
      LOGGING.log('  - acceptedTypes set:', this._acceptedTypes.length, 'types');
      
      fab.value = this._defaultGraph;
      LOGGING.log('  - value set:', this._defaultGraph);
      
      fab.addEventListener('graph-changed', () => {
        LOGGING.log('📊 [TTL-EDITOR] graph-changed event received');
        this.updateSubmitButton();
      });
      LOGGING.log('  - event listener attached');
    } else {
      console.warn('⚠️ [TTL-EDITOR] fab element not found!');
    }
  }
  
  updateFab() {
    LOGGING.log('🔄 [TTL-EDITOR] updateFab() starting...');
    
    const fab = this.shadowRoot.getElementById('graph-fab');
    if (fab) {
      fab.currentIdentity = this._currentIdentity;
      fab.acceptedTypes = this._acceptedTypes;
      if (this._defaultGraph) {
        fab.value = this._defaultGraph;
      }
      LOGGING.log('✅ [TTL-EDITOR] fab updated');
    } else {
      console.warn('⚠️ [TTL-EDITOR] fab element not found in updateFab');
    }
  }
  
  attachEventListeners() {
    LOGGING.log('🔗 [TTL-EDITOR] attachEventListeners() starting...');
    const textarea = this.shadowRoot.getElementById('ttl-input');
    const submitBtn = this.shadowRoot.getElementById('submit-btn');
    const clearBtn = this.shadowRoot.getElementById('clear-btn');
    
    LOGGING.log('🔗 [TTL-EDITOR] Elements:');
    LOGGING.log('  - textarea:', !!textarea);
    LOGGING.log('  - submitBtn:', !!submitBtn);
    LOGGING.log('  - clearBtn:', !!clearBtn);
    
    let debounceTimer;
    textarea?.addEventListener('input', (e) => {
      LOGGING.log('✏️ [TTL-EDITOR] textarea input event');
      this.ttlContent = e.target.value;
      
      // Check if user has modified AI-generated content
      if (this._aiAttribution && this._originalAiContent !== null) {
        const wasModified = this._contentModifiedByUser;
        this._contentModifiedByUser = (this.ttlContent !== this._originalAiContent);
        
        if (wasModified !== this._contentModifiedByUser) {
          LOGGING.log('🤖 [TTL-EDITOR] Content modification state changed:', this._contentModifiedByUser);
          this.updateAttribution();
        }
      }
      
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        LOGGING.log('🔍 [TTL-EDITOR] Validating TTL...');
        this.validateTTL();
        this.updateSubmitButton();
      }, 300);
    });
    
    submitBtn?.addEventListener('click', () => {
      LOGGING.log('🚀 [TTL-EDITOR] Submit button clicked');
      this.handleSubmit();
    });
    
    clearBtn?.addEventListener('click', () => {
      LOGGING.log('🗑️ [TTL-EDITOR] Clear button clicked');
      this.clear();
    });
    
    LOGGING.log('✅ [TTL-EDITOR] Event listeners attached');
  }
  
  validateTTL() {
    const textarea = this.shadowRoot.getElementById('ttl-input');
    const statusDiv = this.shadowRoot.getElementById('validation-status');
    
    if (!this.ttlContent.trim()) {
      this.isValid = false;
      this.validationError = null;
      this.tripleCount = 0;
      
      textarea?.classList.remove('valid', 'invalid', 'ai-generated');
      if (statusDiv) {
        statusDiv.className = 'validation-status empty';
        statusDiv.innerHTML = '⚠️ Enter some Turtle content to begin';
      }
      
      this.dispatchEvent(new CustomEvent('validation-changed', {
        detail: { valid: false, error: 'Empty content' },
        bubbles: true,
        composed: true
      }));
      return;
    }
    
    try {
      LOGGING.log('🔍 [TTL-EDITOR] Parsing TTL with N3...');
      const parser = new N3.Parser();
      const triples = parser.parse(this.ttlContent);
      
      this.isValid = true;
      this.validationError = null;
      this.tripleCount = triples.length;
      LOGGING.log('✅ [TTL-EDITOR] Valid TTL:', this.tripleCount, 'triples');
      
      textarea?.classList.remove('invalid');
      textarea?.classList.add('valid');
      
      // Add AI styling if applicable
      if (this._aiAttribution && !this._contentModifiedByUser) {
        textarea?.classList.add('ai-generated');
      } else {
        textarea?.classList.remove('ai-generated');
      }
      
      if (statusDiv) {
        statusDiv.className = 'validation-status valid';
        statusDiv.innerHTML = `✅ Valid Turtle - ${this.tripleCount} triple${this.tripleCount !== 1 ? 's' : ''}`;
      }
      
      this.dispatchEvent(new CustomEvent('validation-changed', {
        detail: { valid: true, tripleCount: this.tripleCount },
        bubbles: true,
        composed: true
      }));
      
    } catch (error) {
      LOGGING.error('❌ [TTL-EDITOR] Parse error:', error);
      this.isValid = false;
      this.validationError = error.message;
      this.tripleCount = 0;
      
      textarea?.classList.remove('valid', 'ai-generated');
      textarea?.classList.add('invalid');
      
      if (statusDiv) {
        statusDiv.className = 'validation-status invalid';
        statusDiv.innerHTML = `
          ❌ Parse Error
          <div class="error-message">${this.escapeHtml(error.message)}</div>
        `;
      }
      
      this.dispatchEvent(new CustomEvent('validation-changed', {
        detail: { valid: false, error: error.message },
        bubbles: true,
        composed: true
      }));
    }
  }
  
  updateSubmitButton() {
    const submitBtn = this.shadowRoot.getElementById('submit-btn');
    const fab = this.shadowRoot.getElementById('graph-fab');
    if (!submitBtn || !fab) return;
    
    const isAuthenticated = !!this._currentIdentity;
    const hasValidGraph = fab.getValue() && fab.getValue().trim().length > 0;
    
    const canSubmit = this.isValid && hasValidGraph && isAuthenticated;
    submitBtn.disabled = !canSubmit;
    
    if (!isAuthenticated) {
      submitBtn.title = 'Not authenticated - login required';
    } else if (!this.isValid) {
      submitBtn.title = 'TTL content is invalid';
    } else if (!hasValidGraph) {
      submitBtn.title = 'Graph path is required';
    } else {
      const by = this.effectiveBy;
      submitBtn.title = `Submit ${this.tripleCount} triple${this.tripleCount !== 1 ? 's' : ''} as ${by}`;
    }
  }
  
  updateAttribution() {
    const atValue = this.shadowRoot.getElementById('at-value');
    const byValue = this.shadowRoot.getElementById('by-value');
    const aiBadge = this.shadowRoot.getElementById('ai-badge');
    
    if (atValue) {
      atValue.textContent = new Date().toISOString();
    }
    
    if (byValue) {
      const effectiveIdentity = this.effectiveBy;
      byValue.textContent = effectiveIdentity || 'not logged in';
      
      // Style based on attribution type
      byValue.classList.remove('authenticated', 'not-authenticated', 'ai-source');
      if (this._aiAttribution && !this._contentModifiedByUser) {
        byValue.classList.add('ai-source');
      } else if (effectiveIdentity) {
        byValue.classList.add('authenticated');
      } else {
        byValue.classList.add('not-authenticated');
      }
    }
    
    // Show/hide AI badge
    if (aiBadge) {
      if (this._aiAttribution) {
        aiBadge.style.display = 'inline-flex';
        if (this._contentModifiedByUser) {
          aiBadge.classList.add('modified');
          aiBadge.textContent = '🤖 AI (modified)';
          aiBadge.title = 'AI-generated content has been modified. Will submit as your identity.';
        } else {
          aiBadge.classList.remove('modified');
          aiBadge.textContent = '🤖 AI';
          aiBadge.title = `Will submit as ${this._aiAttribution}`;
        }
      } else {
        aiBadge.style.display = 'none';
      }
    }
  }
  
  async handleSubmit() {
    LOGGING.log('🚀 [TTL-EDITOR] handleSubmit() starting...');
    if (!this.isValid || !this._currentIdentity) return;
    
    const fab = this.shadowRoot.getElementById('graph-fab');
    const graph = fab.getValue();
    const at = new Date().toISOString();
    const by = this.effectiveBy;  // Uses AI attribution if content unmodified
    
    LOGGING.log('📦 [TTL-EDITOR] Submitting:', { 
      graph, 
      by, 
      tripleCount: this.tripleCount,
      isAiGenerated: this._aiAttribution && !this._contentModifiedByUser
    });
    
    try {
      if (this._mmmServer) {
        await this._mmmServer.ingestTurtle(this.ttlContent, graph, by);
      } else {
        const response = await fetch('/mmm/api/ingest-ttl', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({
            ttl: this.ttlContent,
            graph,
            by
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      }
      
      LOGGING.log('✅ [TTL-EDITOR] Submission successful');
      this.dispatchEvent(new CustomEvent('ttl-submitted', {
        detail: { 
          ttl: this.ttlContent, 
          graph, 
          at, 
          by, 
          tripleCount: this.tripleCount,
          wasAiGenerated: !!this._aiAttribution,
          wasModified: this._contentModifiedByUser
        },
        bubbles: true,
        composed: true
      }));
      
      this.clear();
      
    } catch (error) {
      LOGGING.error('❌ [TTL-EDITOR] Submission failed:', error);
      
      this.dispatchEvent(new CustomEvent('ttl-error', {
        detail: { error },
        bubbles: true,
        composed: true
      }));
      
      alert(`Failed to submit Turtle:\n${error.message}`);
    }
  }
  
  clear() {
    LOGGING.log('🗑️ [TTL-EDITOR] Clearing form...');
    this.ttlContent = '';
    this.isValid = false;
    this.validationError = null;
    this.tripleCount = 0;
    
    // Reset AI attribution state
    this._aiAttribution = null;
    this._contentModifiedByUser = false;
    this._originalAiContent = null;
    
    const textarea = this.shadowRoot.getElementById('ttl-input');
    const statusDiv = this.shadowRoot.getElementById('validation-status');
    
    if (textarea) {
      textarea.value = '';
      textarea.classList.remove('valid', 'invalid', 'ai-generated');
    }
    
    if (statusDiv) {
      statusDiv.className = 'validation-status empty';
      statusDiv.innerHTML = '⚠️ Enter some Turtle content to begin';
    }
    
    this.updateSubmitButton();
    this.updateAttribution();
    LOGGING.log('✅ [TTL-EDITOR] Form cleared');
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

LOGGING.log('📝 [TTL-EDITOR] Registering custom element...');
customElements.define('ttl-editor-form', TTLEditorFormWC);
LOGGING.log('✅ [TTL-EDITOR] Custom element registered as ttl-editor-form');

export { TTLEditorFormWC };
