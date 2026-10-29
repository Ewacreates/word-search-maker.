# Word Search Maker

A browser-only app using HTML, CSS and vanilla JavaScript. No build, backend, API keys, or dependencies.

## Simple Crossword Generator

The separate crossword tool is available at `crossword/index.html`. It supports traditional intersecting crosswords and horizontal-answer Secret Word column puzzles, printable blank worksheets and answer keys, manual Secret Word letter selection, JSON project files, and browser autosave. The original Word Search Generator remains at the site root.

## Publish for free with GitHub Pages

1. Sign in at https://github.com and choose New repository.
2. Name it word-search-maker, choose Public, and create the repository.
3. On the repository page choose uploading an existing file (or Add file > Upload files).
4. Upload index.html, style.css, script.js, .nojekyll, and this README.md directly to the repository root. Upload the extracted files, not the ZIP or a containing folder. Commit changes to main.
5. Open Settings > Pages in the repository.
6. Under Build and deployment, select Deploy from a branch.
7. Select main and / (root), then Save.
8. Wait for deployment to finish. Refresh Settings > Pages and click the live link GitHub shows.

The usual address is https://ewacreates.github.io/word-search-maker./ . Use the exact address shown by GitHub. It remains available while the repository and Pages remain enabled.

Public repositories have free GitHub Pages hosting. Your source code will be public. Word lists are processed locally in the browser; the app does not upload them.

## Use the app

Enter one word per line. Choose square, circle, tree, star, or heart; difficulty; directions; and automatic or manual grid size. Click Generate Puzzle. Regenerate creates a fresh arrangement using the current controls. The Answer key tab highlights hidden words. Separate PNG and print buttons export the puzzle or matching answers. Use Save as PDF in the browser print dialog for PDF output.

Keep all three application files together. Changes to controls apply when you generate again. Only successfully placed words appear in the puzzle word list. Any omitted words are reported above the preview.

## Placement limits

Up to 100 unique words, each up to 40 letters; grids up to 40 by 40. Input is normalized to uppercase A-Z, punctuation/spaces are removed, and duplicates are removed. Automatic sizing retries placement and enlarges the grid when needed. Manual sizing stays at the selected size. Difficult combinations may still leave words unplaced and display a warning.

## Update later

In GitHub, replace the changed application files and commit to main. Pages republishes automatically. Refresh the permanent link after deployment completes.

## Local use (optional)

Open index.html in Edge, Chrome, or Firefox. No local server is required.
