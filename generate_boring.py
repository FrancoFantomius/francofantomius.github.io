import json
import os

"""
This a script that generates a HTML page from a JSON file. It's used for generating the "boring" version of the website.
"""

def generate_html(json_file, output_file, title, nav_links):
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: {json_file} not found.")
        return

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
        # This is a simple heuristic: if link is "latex.html", make it "boring_latex.html"
        # However, for external links or other pages we keep them as is.
        # Specific overwrites for internal navigation in boring mode:
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

def main():
    # Generate boring_index.html
    generate_html(
        json_file='francofantomius.github.io/points.json',
        output_file='francofantomius.github.io/boring_index.html',
        title='FrancoFantomius (Boring Mode)',
        nav_links=[('Switch to Normal Mode', 'index.html')]
    )

    # Generate boring_latex.html
    generate_html(
        json_file='francofantomius.github.io/points_latex.json',
        output_file='francofantomius.github.io/boring_latex.html',
        title='LaTeX (Boring Mode)',
        nav_links=[('Home', 'boring_index.html'), ('Switch to Normal Mode', 'latex.html')]
    )

if __name__ == "__main__":
    main()
