import json
import os
import re

"""
This script generates the static "boring" HTML pages from JSON configuration files
and synchronizes sitemap.json with the latest titles and descriptions.
"""

def get_meta_description(html_file):
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()
        # Find meta description using regex
        match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', content, re.IGNORECASE)
        if not match:
            # Try alternate order of attributes: content then name
            match = re.search(r'<meta\s+content=["\']([^"\']+)["\']\s+name=["\']description["\']', content, re.IGNORECASE)
        if match:
            return match.group(1)
    except Exception as e:
        print(f"Warning: Could not read description from {html_file}: {e}")
    return ""

def generate_html(json_file, output_file, title, nav_links, original_html=None):
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: {json_file} not found.")
        return

    description = ""
    if original_html:
        description = get_meta_description(original_html)

    css = """
        :root {
            --md-sys-color-primary: #005ac1;
            --md-sys-color-on-primary: #ffffff;
            --md-sys-color-primary-container: #d8e2ff;
            --md-sys-color-on-primary-container: #001a41;
            --md-sys-color-surface: #fdfcff;
            --md-sys-color-on-surface: #1a1c1e;
            --md-sys-color-surface-container: #edeef2;
            --md-sys-color-surface-container-high: #e7e8ec;
            --md-sys-color-surface-container-highest: #e2e2e6;
            --md-sys-color-surface-variant: #e1e2ec;
            --md-sys-color-on-surface-variant: #44474f;
            --md-sys-color-outline: #74777f;
            --md-sys-color-outline-variant: #c4c6d0;
            --page-bg: #f8f9fa;
            color-scheme: light;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --md-sys-color-primary: #adc6ff;
                --md-sys-color-on-primary: #002e69;
                --md-sys-color-primary-container: #004494;
                --md-sys-color-on-primary-container: #d8e2ff;
                --md-sys-color-surface: #111318;
                --md-sys-color-on-surface: #e2e2e6;
                --md-sys-color-surface-container: #1e2025;
                --md-sys-color-surface-container-high: #282a2f;
                --md-sys-color-surface-container-highest: #33353a;
                --md-sys-color-surface-variant: #44474f;
                --md-sys-color-on-surface-variant: #c4c6d0;
                --md-sys-color-outline: #8e9099;
                --md-sys-color-outline-variant: #44474f;
                --page-bg: #111318;
                color-scheme: dark;
            }
        }

        [data-theme="dark"] {
            --md-sys-color-primary: #adc6ff;
            --md-sys-color-on-primary: #002e69;
            --md-sys-color-primary-container: #004494;
            --md-sys-color-on-primary-container: #d8e2ff;
            --md-sys-color-surface: #111318;
            --md-sys-color-on-surface: #e2e2e6;
            --md-sys-color-surface-container: #1e2025;
            --md-sys-color-surface-container-high: #282a2f;
            --md-sys-color-surface-container-highest: #33353a;
            --md-sys-color-surface-variant: #44474f;
            --md-sys-color-on-surface-variant: #c4c6d0;
            --md-sys-color-outline: #8e9099;
            --md-sys-color-outline-variant: #44474f;
            --page-bg: #111318;
            color-scheme: dark;
        }

        [data-theme="light"] {
            --md-sys-color-primary: #005ac1;
            --md-sys-color-on-primary: #ffffff;
            --md-sys-color-primary-container: #d8e2ff;
            --md-sys-color-on-primary-container: #001a41;
            --md-sys-color-surface: #fdfcff;
            --md-sys-color-on-surface: #1a1c1e;
            --md-sys-color-surface-container: #edeef2;
            --md-sys-color-surface-container-high: #e7e8ec;
            --md-sys-color-surface-container-highest: #e2e2e6;
            --md-sys-color-surface-variant: #e1e2ec;
            --md-sys-color-on-surface-variant: #44474f;
            --md-sys-color-outline: #74777f;
            --md-sys-color-outline-variant: #c4c6d0;
            --page-bg: #f8f9fa;
            color-scheme: light;
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 860px;
            margin: 0 auto;
            line-height: 1.6;
            padding: 32px 20px 64px 20px;
            color: var(--md-sys-color-on-surface);
            background-color: var(--page-bg);
            transition: background-color 0.25s ease, color 0.25s ease;
        }

        header.m3-boring-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            padding-bottom: 24px;
            margin-bottom: 32px;
            border-bottom: 1px solid var(--md-sys-color-outline-variant);
        }

        h1.m3-page-title {
            margin: 0;
            font-size: 2rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: var(--md-sys-color-on-surface);
        }

        .m3-header-nav {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .m3-cards-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        md-card.m3-boring-card {
            display: block;
            border-radius: 16px;
            border: 1px solid var(--md-sys-color-outline-variant);
            background-color: var(--md-sys-color-surface-container-high);
            color: var(--md-sys-color-on-surface);
            transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
        }

        md-card.m3-boring-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
        }

        .m3-card-content {
            padding: 20px 24px 20px 24px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .m3-card-header {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .m3-card-icon {
            font-size: 24px;
            color: var(--md-sys-color-primary);
        }

        .m3-card-title {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 600;
            letter-spacing: 0.01em;
            color: var(--md-sys-color-on-surface);
        }

        .m3-card-body {
            margin: 0;
            font-size: 0.95rem;
            line-height: 1.55;
            color: var(--md-sys-color-on-surface-variant);
        }

        .m3-card-actions {
            display: flex;
            justify-content: flex-end;
            padding-top: 8px;
        }

        @media (max-width: 600px) {
            body {
                padding: 20px 16px 40px 16px;
            }
            h1.m3-page-title {
                font-size: 1.6rem;
            }
            .m3-card-content {
                padding: 16px 18px;
            }
        }
    """

    def get_item_icon(item):
        if item.get('icon'):
            return item.get('icon')
        title_lower = item.get('title', '').lower()
        if 'home' in title_lower:
            return 'home'
        if 'latex' in title_lower:
            return 'functions'
        if 'github' in title_lower or 'code' in title_lower:
            return 'code'
        if 'email' in title_lower or 'contact' in title_lower or item.get('link', '').startswith('mailto:'):
            return 'mail'
        if 'archive' in title_lower:
            return 'history'
        if 'book' in title_lower:
            return 'menu_book'
        if 'draw' in title_lower or 'symbol' in title_lower:
            return 'draw'
        if 'download' in item.get('body', '').lower():
            return 'download'
        return 'article'

    nav_html = '<nav class="m3-header-nav">'
    for label, link in nav_links:
        icon = 'arrow_back' if 'Normal' in label else ('home' if 'Home' in label else 'link')
        variant = 'tonal' if 'Normal' in label else 'text'
        nav_html += f'<md-button href="{link}" variant="{variant}" icon="{icon}">{label}</md-button>'
    nav_html += '</nav>'

    items_html = ""
    for item in data:
        item_link = item.get('link', '#')
        # If the link goes to a normal html page that has a boring counterpart, switch it
        if item_link == "latex.html":
            item_link = "boring_latex.html"
        
        button_text = "Visit Link"
        button_icon = "open_in_new"
        if "Download" in item.get('body', ''):
             button_text = "Download File"
             button_icon = "download"
        elif item_link.endswith(".html"):
             button_text = "Visit Page"
             button_icon = "arrow_forward"
        elif item_link.startswith("mailto:"):
             button_text = "Send Email"
             button_icon = "mail"

        target_attr = ' target="_blank"'
        if item.get('redirect') or item_link.endswith('.html'):
            target_attr = ' target="_self"'

        icon = get_item_icon(item)
        body_text = item.get('body', '')
        body_html = f'<p class="m3-card-body">{body_text}</p>' if body_text else ''

        items_html += f"""
        <md-card class="m3-boring-card" variant="outlined">
            <div class="m3-card-content">
                <div class="m3-card-header">
                    <span class="material-symbols-outlined m3-card-icon">{icon}</span>
                    <h2 class="m3-card-title">{item.get('title', 'No Title')}</h2>
                </div>
                {body_html}
                <div class="m3-card-actions">
                    <md-button href="{item_link}"{target_attr} variant="filled" icon="{button_icon}">{button_text}</md-button>
                </div>
            </div>
        </md-card>"""

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="{description}">
    <title>{title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" />
    <style>{css}</style>
    <link rel="icon" type="image/svg+xml" href="icons/favicon.svg">
    <script type="importmap">
        {{
            "imports": {{
                "lit": "https://cdn.jsdelivr.net/npm/lit@3.3.3/+esm",
                "lit/decorators.js": "https://cdn.jsdelivr.net/npm/lit@3.3.3/decorators/+esm",
                "lit/directives/unsafe-html.js": "https://cdn.jsdelivr.net/npm/lit@3.3.3/directives/unsafe-html/+esm",
                "@francofantomius/material-components/theme": "https://cdn.jsdelivr.net/npm/@francofantomius/material-components@1.4.1/dist/tokens/index.js",
                "@francofantomius/material-components/card": "https://cdn.jsdelivr.net/npm/@francofantomius/material-components@1.4.1/dist/components/card/card.js",
                "@francofantomius/material-components/button": "https://cdn.jsdelivr.net/npm/@francofantomius/material-components@1.4.1/dist/components/button/button.js",
                "@francofantomius/material-components/icon-button": "https://cdn.jsdelivr.net/npm/@francofantomius/material-components@1.4.1/dist/components/icon-button/icon-button.js",
                "@francofantomius/material-components": "https://cdn.jsdelivr.net/npm/@francofantomius/material-components@1.4.1/dist/index.js"
            }}
        }}
    </script>
    <script type="module">
        import '@francofantomius/material-components/card';
        import '@francofantomius/material-components/button';
        import '@francofantomius/material-components/icon-button';
        import {{ applyTheme, lightColorScheme, darkColorScheme, generateColorScheme }} from '@francofantomius/material-components/theme';

        // Synchronize with stored site theme and custom/accent color
        const savedTheme = localStorage.getItem('site-theme') || 'system';
        const savedColor = localStorage.getItem('site-color') || '#0044aa';
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        function updateTheme() {{
            const isDark = savedTheme === 'dark' || (savedTheme === 'system' && mediaQuery.matches);
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
            try {{
                const dynamicScheme = generateColorScheme(savedColor, isDark);
                applyTheme(dynamicScheme, document.documentElement);
            }} catch (e) {{
                const fallbackScheme = isDark ? darkColorScheme : lightColorScheme;
                applyTheme(fallbackScheme, document.documentElement);
            }}
        }}

        updateTheme();
        mediaQuery.addEventListener('change', () => {{
            if (savedTheme === 'system') updateTheme();
        }});
    </script>
</head>
<body>

    <header class="m3-boring-header">
        <h1 class="m3-page-title">{title}</h1>
        {nav_html}
    </header>

    <main class="m3-cards-list">
        {items_html}
    </main>

</body>
</html>
"""

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"Generated {output_file}")

def update_sitemap(sitemap_file, points_files):
    if not os.path.exists(sitemap_file):
        print(f"Warning: {sitemap_file} not found. Cannot update sitemap.")
        return

    try:
        with open(sitemap_file, 'r', encoding='utf-8') as f:
            sitemap = json.load(f)
    except Exception as e:
        print(f"Error loading sitemap.json: {e}")
        return

    # Load all points from both files
    all_points = []
    for pf in points_files:
        if os.path.exists(pf):
            try:
                with open(pf, 'r', encoding='utf-8') as f:
                    all_points.extend(json.load(f))
            except Exception as e:
                print(f"Error loading points file {pf}: {e}")

    def normalize_link(link):
        if not link:
            return ""
        # Remove domains and normalize slashes
        link = re.sub(r'^https?://(www\.)?francofantomius\.com/', '', link)
        link = re.sub(r'^https?://(www\.)?github\.com/+', 'github.com/', link)
        link = link.strip('/')
        return link

    # Create mapping from normalized link to point info
    point_map = {}
    for pt in all_points:
        norm = normalize_link(pt.get('link'))
        if norm:
            point_map[norm] = pt

    updated = False
    for key, marker in sitemap.items():
        norm_sitemap_link = normalize_link(marker.get('link'))
        
        # Setup lookup keys (checking original links for boring mode pages)
        search_keys = [norm_sitemap_link]
        if norm_sitemap_link == 'boring_latex.html':
            search_keys.append('latex.html')
        elif norm_sitemap_link == 'boring_index.html':
            search_keys.append('index.html')

        matched_point = None
        for sk in search_keys:
            if sk in point_map:
                matched_point = point_map[sk]
                break

        if matched_point:
            # Sync title using 'short' name if available, otherwise 'title'
            new_title = matched_point.get('short') or matched_point.get('title')
            if 'boring' in norm_sitemap_link:
                new_title = f"{new_title} (Boring)"
                
            new_desc = matched_point.get('body')

            if marker.get('title') != new_title or marker.get('desc') != new_desc:
                marker['title'] = new_title
                marker['desc'] = new_desc
                updated = True

    # Find all links already covered in sitemap
    covered_links = set()
    used_paths = set()
    used_labels = set()

    for key, marker in sitemap.items():
        used_labels.add(key)
        used_paths.add(tuple(marker.get('path', [])))
        norm_sitemap_link = normalize_link(marker.get('link'))
        if norm_sitemap_link:
            covered_links.add(norm_sitemap_link)
        if norm_sitemap_link == 'boring_latex.html':
            covered_links.add('latex.html')
        elif norm_sitemap_link == 'boring_index.html':
            covered_links.add('index.html')

    # Palette for newly generated nodes
    palette = [
        "#0284c7", "#0d9488", "#0ea5e9", "#06b6d4",
        "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
        "#10b981", "#14b8a6", "#3b82f6", "#a855f7"
    ]

    def get_next_label():
        for code in range(ord('A'), ord('Z') + 1):
            char = chr(code)
            if char not in used_labels:
                return char
        for c1 in range(ord('A'), ord('Z') + 1):
            for c2 in range(ord('A'), ord('Z') + 1):
                pair = f"{chr(c1)}{chr(c2)}"
                if pair not in used_labels:
                    return pair
        return "X"

    def get_next_path():
        queue = [[0]]
        while queue:
            cur = queue.pop(0)
            if tuple(cur) not in used_paths:
                return cur
            if len(cur) < 8:
                queue.append(cur + [0])
                queue.append(cur + [1])
        return [0, 0, 0, 0]

    # Add any unmapped points from points files into sitemap
    for pt in all_points:
        raw_link = pt.get('link', '')
        norm = normalize_link(raw_link)
        if not norm or norm in covered_links:
            continue

        label = get_next_label()
        used_labels.add(label)
        path = get_next_path()
        used_paths.add(tuple(path))

        final_link = raw_link
        if not re.match(r'^(https?://|mailto:)', raw_link):
            final_link = f"/{raw_link.lstrip('/')}"
        elif raw_link.startswith('https://francofantomius.com/'):
            final_link = '/' + raw_link.replace('https://francofantomius.com/', '').lstrip('/')

        color_index = len(sitemap) % len(palette)
        sitemap[label] = {
            "label": label,
            "title": pt.get('short') or pt.get('title', 'Link'),
            "link": final_link,
            "desc": pt.get('body', ''),
            "color": palette[color_index],
            "path": path
        }
        covered_links.add(norm)
        updated = True

    if updated:
        with open(sitemap_file, 'w', encoding='utf-8') as f:
            json.dump(sitemap, f, indent=4, ensure_ascii=False)
        print(f"Successfully updated {sitemap_file} with descriptions from points.")
    else:
        print(f"No description/title updates needed for {sitemap_file}.")

def generate_sitemap_xml(sitemap_file, xml_file):
    try:
        with open(sitemap_file, 'r', encoding='utf-8') as f:
            sitemap_data = json.load(f)
    except Exception as e:
        print(f"Error loading {sitemap_file} for XML sitemap generation: {e}")
        return

    base_url = "https://francofantomius.com"
    urls = []
    
    for key, item in sitemap_data.items():
        link = item.get('link', '')
        if not link:
            continue
        
        # Check if it is a local link
        if link.startswith('/') and not link.startswith('//'):
            # Only include HTML pages (exclude assets like .sty and exclude 404 page)
            if link.endswith('.html') and link != '/404.html':
                if link == '/index.html':
                    urls.append(base_url + '/')
                else:
                    urls.append(base_url + link)
            elif link == '/':
                urls.append(base_url + '/')

    # Deduplicate while preserving order
    unique_urls = []
    for u in urls:
        if u not in unique_urls:
            unique_urls.append(u)

    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for url in unique_urls:
        xml_lines.append('  <url>')
        xml_lines.append(f'    <loc>{url}</loc>')
        xml_lines.append('  </url>')
    xml_lines.append('</urlset>\n')

    with open(xml_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(xml_lines))
    print(f"Generated {xml_file}")

def main():
    # Ensure build directory exists
    os.makedirs('build', exist_ok=True)

    # Generate boring_index.html in build/
    generate_html(
        json_file=os.path.join('data', 'points.json'),
        output_file=os.path.join('build', 'boring_index.html'),
        title='FrancoFantomius (Boring Mode)',
        nav_links=[('Switch to Normal Mode', 'index.html')],
        original_html='index.html'
    )

    # Generate boring_latex.html in build/
    generate_html(
        json_file=os.path.join('data', 'points_latex.json'),
        output_file=os.path.join('build', 'boring_latex.html'),
        title='LaTeX (Boring Mode)',
        nav_links=[('Home', 'boring_index.html'), ('Switch to Normal Mode', 'latex.html')],
        original_html='latex.html'
    )

    # Update sitemap.json
    sitemap_path = os.path.join('data', 'sitemap.json')
    update_sitemap(sitemap_path, [os.path.join('data', 'points.json'), os.path.join('data', 'points_latex.json')])

    # Generate sitemap.xml in build/
    generate_sitemap_xml(sitemap_path, os.path.join('build', 'sitemap.xml'))

if __name__ == "__main__":
    main()
