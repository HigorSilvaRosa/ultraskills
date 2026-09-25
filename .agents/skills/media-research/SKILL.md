---
name: media-research
description: Helps the agent search for media (audio, image, video, gif) in internet repositories for a given subject. Use this skill when the user asks to find, download, or search for media.
---

# Media Research Skill

This skill allows the agent to search for media (audio, images, videos, gifs) across free internet repositories. We currently support:
- **Unsplash**: World-class free photography.
- **Pexels**: High-quality free stock photos and videos.
- **Pixabay**: Vast library of free images and videos.
- **Freesound**: Collaborative database of audio snippets, samples, and recordings.
- **Wikimedia Commons**: Massive repository of public domain images (NO API KEY REQUIRED).
- **Giphy**: The largest GIF library (Requires API Key).
- **Jamendo**: Royalty-free full music tracks (Requires Client ID).

## Prerequisites: API Keys

This skill requires API keys to be present in the `.env` file at the root of the workspace directory. The supported keys are:
- `UNSPLASH_ACCESS_KEY` (for images) - Get it at: https://unsplash.com/developers
- `PEXELS_API_KEY` (for images and videos) - Get it at: https://www.pexels.com/api/
- `PIXABAY_API_KEY` (for images and videos) - Get it at: https://pixabay.com/api/docs/
- `FREESOUND_API_KEY` (for audio) - Get it at: https://freesound.org/docs/api/
- `GIPHY_API_KEY` (for gifs) - Get it at: https://developers.giphy.com/
- `JAMENDO_CLIENT_ID` (for music) - Get it at: https://developer.jamendo.com/v3.0

**Crucial Step 1:** ALWAYS check if the `.env` file at the root of the project contains at least one of these keys before proceeding (unless you are only searching Wikimedia Commons, which requires no keys).
If the `.env` file doesn't exist or doesn't have the keys needed for the specific search, **STOP** and instruct the user to update the `.env` file.

## Searching for Media

Once you have verified the keys, use the bundled python script to perform the search. The script performs fast concurrent searches.

### Using the Search Script

The script supports searching for images, videos, audio, gifs, or all.

```bash
# Basic image search:
python <path_to_skill_dir>/scripts/search_media.py "your search term" --type image --env_path <path_to_workspace_root>/.env

# Advanced search with filters and limits:
python <path_to_skill_dir>/scripts/search_media.py "your search term" --type video --limit 10 --orientation landscape --color blue --env_path <path_to_workspace_root>/.env

# Search for gifs:
python <path_to_skill_dir>/scripts/search_media.py "funny dog" --type gif --limit 5 --env_path <path_to_workspace_root>/.env
```
*(Replace `<path_to_skill_dir>` with the absolute path to this skill's directory, and `<path_to_workspace_root>` with the absolute path to the user's workspace root.)*

The script outputs a JSON array containing the media results.

## Presenting the Results

Parse the JSON output from the script and present the results to the user in a clear, formatted markdown list.

### Expected Output Format Example

### Media Results for "[Search Term]"

**1. [Title]**
*   **Type:** [Image / Video / Audio / Gif]
*   **Source:** [Repository Name]
*   **URL:** [Direct link to the media]
*   **Author:** [Author/Creator Name]

*(Repeat for the best results returned by the script)*

## Downloading Media

If the user asks you to download any of the files to their workspace, **ALWAYS** use the dedicated download script. Do not use generic curl/wget commands.

```bash
python <path_to_skill_dir>/scripts/download_media.py "[Direct link to the media]" "path/to/save/filename.ext"
```
