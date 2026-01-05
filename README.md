# FrancoFantomius - Personal Website 3D

This repository contains the source code for the personal website [francofantomius.com](https://francofantomius.com).

The project is an interactive web application that renders 3D fractals in real-time using **Three.js**. The site serves as a central hub for my online presence (GitHub, Email, etc.), presented as interactive markers within a 3D space.

## Features

*   **Real-Time 3D Rendering**: Built with WebGL and Three.js to display complex geometries directly in the browser.
*   **Two Fractal Modes**:
    *   **Sierpiński Tetrahedron** (`index.html`): The main landing page, featuring a recursive tetrahedron fractal.
    *   **Menger Sponge** (`latex.html`): An alternate "LaTeX" themed page featuring a recursive cube fractal.
*   **"Breathing" Animation**: The fractals automatically cycle through different depth levels (e.g., from 1 to 7 iterations) to visualize the recursive nature of the shapes.
*   **Boring Mode**: A simplified, text-only version of the site for users who prefer a static HTML experience or have disabled JavaScript.
    *   Accessible via the settings menu or directly at `boring_index.html` and `boring_latex.html`.
*   **Optimized Performance**: Utilizes `THREE.InstancedMesh` to render thousands of instances in a single draw call, maintaining high frame rates.
*   **User Interface (UI)**:
    *   Settings panel to change the base color and toggle auto-rotation.
    *   Real-time polygon/cube count display.
*   **Interactive Markers**: HTML labels overlaying the 3D scene that track the position of objects in 3D space, linking to external resources.

## Tech Stack

*   **HTML5 & CSS3**: Structure and styling for the overlay UI.
*   **JavaScript (ES6+)**: Application logic using ES modules.
*   **[Three.js](https://threejs.org/)**: Core 3D library (loaded via CDN using Import Maps).
*   **Python**: Utility script for generating static "Boring Mode" pages.

## Installation & Local Development

Since this project uses ES6 modules (`<script type="module">`) and external imports, it cannot be opened directly as a local file (e.g., double-clicking `index.html`) due to browser CORS policies. You must use a local server.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/FrancoFantomius/francofantomius.github.io.git
    cd francofantomius.github.io
    ```

2.  **Start a local server:**
    If you have Python installed:
    ```bash
    python -m http.server 8000
    ```
    Or if you use Node.js and have `http-server`:
    ```bash
    npx http-server
    ```
    Alternatively, if you use VS Code, you can use the **Live Server** extension.

3.  **Open your browser:**
    Navigate to `http://localhost:8000` (or the port specified by your server).

### Generating Boring Mode Pages

The "Boring Mode" pages (`boring_index.html` and `boring_latex.html`) are generated automatically based on the data in `points.json` and `points_latex.json`.

To regenerate them (e.g., after updating links), run:

```bash
python generate_boring.py
```

## Project Structure

*   **`index.html` / `script.js`**: Main entry point and logic for the Sierpiński Tetrahedron.
    *   `generateFractal()` handles the recursive geometry creation.
*   **`latex/latex.html` / `latex.js`**: Specific page for the Menger Sponge fractal.
*   **`boring_index.html` / `boring_latex.html`**: Static, low-tech counterparts to the 3D pages.
*   **`generate_boring.py`**: Python script to build the boring mode HTML files from JSON data.
*   **`points.json` / `points_latex.json`**: Data files containing coordinates and metadata for the interactive markers.
*   **`CNAME`**: GitHub Pages configuration file to point to the custom domain `francofantomius.com`.

## Customization

You can modify the default parameters inside the `params` object in the scripts:

```javascript
const params = {
    depth: 1,         // Initial fractal depth
    color: '#0044aa', // Initial color
    autoRotate: false,// Auto-rotation on load
    size: 40          // Global size of the shape
};
```
