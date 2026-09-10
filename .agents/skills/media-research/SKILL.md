---
name: media-research
description: Helps the agent search for media (audio, image, video) in internet repositories for a given subject. Use this skill when the user asks to find, download, or search for media like images, videos, or audio tracks.
---

# Media Research Skill

This skill allows the agent to search for media (audio, images, videos) across free internet repositories. We currently support:
- **Unsplash**: World-class free photography.
- **Pexels**: High-quality free stock photos and videos.
- **Pixabay**: Vast library of free images and videos.
- **Freesound**: Collaborative database of audio snippets, samples, and recordings.

## Prerequisites: API Keys

This skill requires API keys to be present in the `.env` file at the root of the workspace directory. The supported keys are:
- `UNSPLASH_ACCESS_KEY` (for images) - Get it at: https://unsplash.com/developers
- `PEXELS_API_KEY` (for images and videos) - Get it at: https://www.pexels.com/api/
- `PIXABAY_API_KEY` (for images and videos) - Get it at: https://pixabay.com/api/docs/
- `FREESOUND_API_KEY` (for audio) - Get it at: https://freesound.org/docs/api/

**Crucial Step 1:** ALWAYS check if the `.env` file at the root of the project contains at least one of these keys before proceeding.
If the `.env` file doesn't exist or doesn't have any of these keys, **STOP** and instruct the user to create the `.env` file (or copy it from `.env.example` / the skill's `assets/.env.example`) and fill in the keys they want to use. Provide them with the links above so they know where to get them.

## Searching for Media

Once you have verified the keys, use the bundled python script to perform the search. The script is completely self-contained and uses only standard libraries, automatically loading keys from the specified `.env` file.

### Using the Search Script

The script supports searching for images, videos, or audio. 

```bash
# To search for images:
python <path_to_skill_dir>/scripts/search_media.py "your search term" --type image --env_path <path_to_workspace_root>/.env

# To search for videos:
python <path_to_skill_dir>/scripts/search_media.py "your search term" --type video --env_path <path_to_workspace_root>/.env

# To search for audio:
python <path_to_skill_dir>/scripts/search_media.py "your search term" --type audio --env_path <path_to_workspace_root>/.env
```
*(Replace `<path_to_skill_dir>` with the absolute path to this skill's directory, and `<path_to_workspace_root>` with the absolute path to the user's workspace root.)*

The script outputs a JSON array containing the media results.

## Presenting the Results

Parse the JSON output from the script and present the results to the user in a clear, formatted markdown list.

### Expected Output Format Example

### Media Results for "[Search Term]"

**1. [Title]**
*   **Type:** [Image / Video / Audio]
*   **Source:** [Repository Name]
*   **URL:** [Direct link to the media]
*   **Author:** [Author/Creator Name]

*(Repeat for the best results returned by the script)*

Offer to download any of the files to the user's workspace using `urllib.request` or standard tools if they would like.
