# ttl-editor-form

A standalone web component for bulk Turtle (TTL) ingestion into MMM.

## Features

- 🎯 **Bulk TTL ingestion** - Paste or type Turtle directly
- 📝 **Live validation** - Parse-on-the-fly with error highlighting
- 🎛️ **Mental space selection** - Uses mntl-space-fab component
- 🔒 **Authentication aware** - Submit only when authenticated
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
# Visit http://localhost:8080/example/
```

## Usage

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

## API

### Properties

- `mmmServer` - MMMServer instance
- `currentIdentity` - User identity (required)
- `defaultGraph` - Default graph URI
- `acceptedTypes` - Array of mental space types

### Events

- `ttl-submitted` - Success
- `validation-changed` - Validation state changed
- `ttl-error` - Submission error

## License

AGPL-3.0-or-later
