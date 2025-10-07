import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Listen for console events and print them
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # Get the absolute path to the HTML file
        html_file_path = os.path.abspath('jules-scratch/verification/index.html')

        # Navigate to the local HTML file
        page.goto(f'file://{html_file_path}')

        # Wait for the map to render (give it a moment)
        page.wait_for_timeout(2000)

        # Take a screenshot
        page.screenshot(path='jules-scratch/verification/verification.png')

        browser.close()

if __name__ == "__main__":
    run()