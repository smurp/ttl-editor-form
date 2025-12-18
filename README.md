# ttl-editor-form

A standalone web component for bulk Turtle (TTL) ingestion into MMM.

![TTL Editor Form Example](img/example1.png)

## Features

- 🎯 **Bulk TTL ingestion** - Paste or type Turtle directly
- 📝 **Live validation** - Parse-on-the-fly with error highlighting
- 🎛️ **Mental space selection** - Uses mntl-space-fab component
- 🔒 **Authentication aware** - Submit only when authenticated
- 🤖 **AI attribution support** - Track LLM-generated content with proper provenance
- ✨ **Simple UX** - Clean, focused interface

## Installation

### For Development (using npm link)

```bash
# First, link mntl-space-fab
cd ~/REPOS/mntl-space-fab
npm install
npm link

# Then setup ttl-editor-form
cd ~/REPOS/ttl-editor-form
npm install
npm link @mmmlib/mntl-space-fab
```

### For Production (using GitHub)

The package.json already references GitHub:

```json
{
  "dependencies": {
    "n3": "^1.17.2",
    "@mmmlib/mntl-space-fab": "github:smurp/mntl-space-fab#main"
  }
}
```

Then:

```bash
npm install
```

## Development Workflow

Since these packages are under active development in ~/REPOS:

```bash
# Initial setup
cd ~/REPOS/mntl-space-fab && npm install && npm link
cd ~/REPOS/ttl-editor-form && npm install && npm link @mmmlib/mntl-space-fab

# After making changes to mntl-space-fab
cd ~/REPOS/mntl-space-fab
# Changes are immediately available to ttl-editor-form via symlink

# Run dev server
cd ~/REPOS/ttl-editor-form
npm run dev
# Visit http://localhost:8002/example/
```

## Usage

### Basic Usage

```html
<script type="module" src="path/to/ttl-editor-form.js"></script>
<ttl-editor-form></ttl-editor-form>
```

```javascript
const form = document.querySelector('ttl-editor-form');
form.currentIdentity = 'mailto:alice@example.com';
form.acceptedTypes = [
  { value: 'mntl:open', label: 'mntl:open/{identity}',
    description: 'mntl:open - Owned by you, readable by the world' },
  { value: 'mntl:publ', label: 'mntl:publ',
    description: 'mntl:publ - A true public commons' }
];

form.addEventListener('ttl-submitted', (e) => {
  console.log(`Submitted ${e.detail.tripleCount} triples`);
});
```

### AI-Generated Content

When integrating with LLM-based TTL generation (e.g., `aigenviz`), use the AI attribution features to preserve provenance:

```javascript
const form = document.querySelector('ttl-editor-form');

// Set AI attribution BEFORE setting content
form.aiAttribution = 'llm:ollama/mistral:7b';
form.setContent(generatedTTL);

// The form will now:
// - Display "by: llm:ollama/mistral:7b" with purple styling
// - Show 🤖 AI badge
// - Submit with by = 'llm:ollama/mistral:7b'

// If the user edits the content:
// - Badge changes to "🤖 AI (modified)"
// - by reverts to currentIdentity
// - Submit with by = currentIdentity
```

## API Reference

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `mmmServer` | MMMServer | Server instance for direct submission |
| `currentIdentity` | string | User identity (required for authentication) |
| `defaultGraph` | string | Default graph URI (default: `'mntl:publ/imported'`) |
| `acceptedTypes` | array | Array of mental space types |
| `aiAttribution` | string | AI model identifier (e.g., `'llm:ollama/mistral:7b'`) |

### Read-Only Properties

| Property | Type | Description |
|----------|------|-------------|
| `effectiveBy` | string | The identity that will be used for submission. Returns `aiAttribution` if content is unmodified, otherwise `currentIdentity`. |
| `isValid` | boolean | Whether current TTL content is valid |
| `tripleCount` | number | Number of triples in valid TTL |

### Methods

| Method | Description |
|--------|-------------|
| `setContent(ttl)` | Programmatically set TTL content. Resets modification tracking so AI attribution applies. |
| `clear()` | Clear the textarea, reset validation, and clear AI attribution state. |

### Events

#### `ttl-submitted`
Fired when TTL is successfully submitted.

```javascript
form.addEventListener('ttl-submitted', (e) => {
  const { ttl, graph, at, by, tripleCount, wasAiGenerated, wasModified } = e.detail;
  console.log(`Submitted ${tripleCount} triples as ${by}`);
  if (wasAiGenerated && !wasModified) {
    console.log('Content was AI-generated and unmodified');
  }
});
```

#### `validation-changed`
Fired when validation state changes.

```javascript
form.addEventListener('validation-changed', (e) => {
  const { valid, error, tripleCount } = e.detail;
  if (valid) {
    console.log(`Valid: ${tripleCount} triples`);
  } else {
    console.log(`Invalid: ${error}`);
  }
});
```

#### `ttl-error`
Fired on submission error.

```javascript
form.addEventListener('ttl-error', (e) => {
  console.error('Submission failed:', e.detail.error);
});
```

## AI Attribution Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                         aigenviz                                │
│  User prompt → LLM → TTL                                        │
│                        │                                        │
│  form.aiAttribution = 'llm:provider/model'                      │
│  form.setContent(ttl)                                           │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ttl-editor-form                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ by: llm:ollama/mistral:7b  [🤖 AI]                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ @prefix ex: <http://example.org/> .                     │   │
│  │ ex:Alice ex:knows ex:Bob .                              │   │
│  │ ...                                          (purple    │   │
│  │                                               border)   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                    [Submit Turtle]                              │
└─────────────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    User edits                    User submits as-is
         │                               │
         ▼                               ▼
┌─────────────────────┐     ┌─────────────────────────┐
│ Badge: "AI (modified)"│   │ by: llm:ollama/mistral:7b│
│ by: currentIdentity  │     │ (AI provenance preserved)│
└─────────────────────┘     └─────────────────────────┘
```

## Visual Indicators

| State | Border | Badge | `by:` color |
|-------|--------|-------|-------------|
| Empty | Gray | None | — |
| Valid (user content) | Green | None | Green |
| Invalid | Red | None | — |
| AI-generated, unmodified | Purple | 🤖 AI | Purple |
| AI-generated, modified | Green | 🤖 AI (modified) | Green |

## Component Loading

The ttl-editor-form uses **dynamic loading** for its dependency on `mntl-space-fab`:

- Automatically loads mntl-space-fab from `/mntl-space-fab/src/mntl-space-fab.js`
- Requires MMM server to have registered the route: `app.use('/mntl-space-fab', ...)`
- Throws error if component fails to load (no silent fallback)

This matches the pattern used by quad-form for maximum portability across deployment contexts (browser, Electron, extensions, etc.).

## Server-Side Integration

The form expects a POST endpoint at `/mmm/api/ingest-ttl`:

```javascript
router.post('/api/ingest-ttl', async (req, res) => {
  const { ttl, graph, by } = req.body;
  
  try {
    const parser = new N3.Parser();
    const quads = parser.parse(ttl);
    
    // Convert to MMM format and ingest
    const results = await Promise.all(
      quads.map(quad => mmmServer.ingestFlat({
        s: quad.subject.value,
        p: quad.predicate.value,
        o: quad.object.value,
        g: graph,
        at: new Date().toISOString(),
        by: by,  // Will be AI attribution or user identity
        ...(quad.object.datatype && { d: quad.object.datatype.value }),
        ...(quad.object.language && { l: quad.object.language })
      }))
    );
    
    res.json({
      success: true,
      tripleCount: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

## License

AGPL-3.0-or-later