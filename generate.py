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
        body { font-family: sans-serif; max-width: 800px; margin: 20px auto; line-height: 1.6; padding: 0 20px; color: #333; }
        h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .item { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .item h2 { margin-top: 0; }
        .item a { color: #0044aa; text-decoration: none; font-weight: bold; }
        .item a:hover { text-decoration: underline; }
        .nav { margin-bottom: 20px; text-align: right; }
        .nav a { background: #eee; padding: 5px 10px; border-radius: 4px; text-decoration: none; color: #333; margin-left: 10px;}
    """

    nav_html = '<div class="nav">'
    for label, link in nav_links:
        nav_html += f'<a href="{link}">{label}</a>'
    nav_html += '</div>'

    items_html = ""
    for item in data:
        item_link = item.get('link', '#')
        # If the link goes to a normal html page that has a boring counterpart, switch it
        if item_link == "latex.html":
            item_link = "boring_latex.html"
        
        button_text = "Visit Link"
        if "Download" in item.get('body', ''):
             button_text = "Download File"
        if item_link.endswith(".html"):
             button_text = "Visit Page"

        target_attr = ' target="_blank"'
        if item.get('redirect'):
            target_attr = ' target="_self"'

        items_html += f"""
    <div class="item">
        <h2>{item.get('title', 'No Title')}</h2>
        <p>{item.get('body', '')}</p>
        <a href="{item_link}"{target_attr}>{button_text}</a>
    </div>"""

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="{description}">
    <title>{title}</title>
    <style>{css}</style>
    <link rel="icon" type="image/svg+xml" href="icons/favicon.svg">
</head>
<body>

    {nav_html}

    <h1>{title}</h1>

    {items_html}

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
        link = re.sub(r'^https?://(www\.)?github\.com/', 'github.com/', link)
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
    # Generate boring_index.html
    generate_html(
        json_file='points.json',
        output_file='boring_index.html',
        title='FrancoFantomius (Boring Mode)',
        nav_links=[('Switch to Normal Mode', 'index.html')],
        original_html='index.html'
    )

    # Generate boring_latex.html
    generate_html(
        json_file='points_latex.json',
        output_file='boring_latex.html',
        title='LaTeX (Boring Mode)',
        nav_links=[('Home', 'boring_index.html'), ('Switch to Normal Mode', 'latex.html')],
        original_html='latex.html'
    )

    # Update sitemap.json
    update_sitemap('sitemap.json', ['points.json', 'points_latex.json'])

    # Generate sitemap.xml
    generate_sitemap_xml('sitemap.json', 'sitemap.xml')

if __name__ == "__main__":
    main()
