import os
import argparse
import urllib.request
import urllib.parse
import json
import concurrent.futures

def load_env(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip("'").strip('"')

def make_request(url, headers=None):
    if headers is None:
        headers = {}
    if "User-Agent" not in headers:
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MediaResearchBot/1.0"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        import sys
        sys.stderr.write(f"Request error for {url}: {e}\n")
        return {}

def search_pexels(query, media_type, api_key, limit, orientation=None, color=None):
    headers = {"Authorization": api_key}
    results = []
    encoded_query = urllib.parse.quote(query)
    
    # Pexels supports orientation and color parameters
    extra_params = ""
    if orientation:
        extra_params += f"&orientation={orientation}"
    if color:
        extra_params += f"&color={color}"
        
    if media_type in ['image', 'all']:
        data = make_request(f"https://api.pexels.com/v1/search?query={encoded_query}&per_page={limit}{extra_params}", headers)
        for item in data.get('photos', []):
            results.append({
                "type": "image",
                "source": "Pexels",
                "title": item.get('alt', 'Untitled'),
                "url": item.get('src', {}).get('original'),
                "page_url": item.get('url'),
                "author": item.get('photographer')
            })
            
    if media_type in ['video', 'all']:
        data = make_request(f"https://api.pexels.com/videos/search?query={encoded_query}&per_page={limit}{extra_params}", headers)
        for item in data.get('videos', []):
            video_files = item.get('video_files', [])
            best_video = video_files[0].get('link') if video_files else item.get('url')
            results.append({
                "type": "video",
                "source": "Pexels",
                "title": "Video by " + item.get('user', {}).get('name', 'Unknown'),
                "url": best_video,
                "page_url": item.get('url'),
                "author": item.get('user', {}).get('name')
            })
    return results

def search_pixabay(query, media_type, api_key, limit, orientation=None, color=None):
    results = []
    encoded_query = urllib.parse.quote(query)
    
    extra_params = ""
    if orientation:
        # Pixabay orientation: "all", "horizontal", "vertical"
        p_orient = "horizontal" if orientation == "landscape" else "vertical" if orientation == "portrait" else "all"
        extra_params += f"&orientation={p_orient}"
    if color:
        extra_params += f"&colors={color}"
    
    if media_type in ['image', 'all']:
        data = make_request(f"https://pixabay.com/api/?key={api_key}&q={encoded_query}&per_page={max(3, limit)}{extra_params}")
        for item in data.get('hits', [])[:limit]:
            results.append({
                "type": "image",
                "source": "Pixabay",
                "title": item.get('tags', 'Untitled'),
                "url": item.get('largeImageURL'),
                "page_url": item.get('pageURL'),
                "author": item.get('user')
            })
            
    if media_type in ['video', 'all']:
        data = make_request(f"https://pixabay.com/api/videos/?key={api_key}&q={encoded_query}&per_page={max(3, limit)}")
        for item in data.get('hits', [])[:limit]:
            videos = item.get('videos', {})
            best_video = videos.get('large', {}).get('url')
            if not best_video:
                best_video = videos.get('medium', {}).get('url')
            results.append({
                "type": "video",
                "source": "Pixabay",
                "title": item.get('tags', 'Untitled'),
                "url": best_video,
                "page_url": item.get('pageURL'),
                "author": item.get('user')
            })
    return results

def search_freesound(query, api_key, limit):
    results = []
    encoded_query = urllib.parse.quote(query)
    data = make_request(f"https://freesound.org/apiv2/search/text/?query={encoded_query}&token={api_key}&fields=id,name,url,username,previews&page_size={limit}")
    for item in data.get('results', []):
        results.append({
            "type": "audio",
            "source": "Freesound",
            "title": item.get('name'),
            "url": item.get('previews', {}).get('preview-hq-mp3', ''),
            "page_url": item.get('url'),
            "author": item.get('username')
        })
    return results

def search_unsplash(query, api_key, limit, orientation=None, color=None):
    headers = {"Authorization": f"Client-ID {api_key}"}
    results = []
    encoded_query = urllib.parse.quote(query)
    
    extra_params = ""
    if orientation:
        # squarish, landscape, portrait
        u_orient = "landscape" if orientation == "landscape" else "portrait" if orientation == "portrait" else "squarish"
        extra_params += f"&orientation={u_orient}"
    if color:
        extra_params += f"&color={color}"
        
    data = make_request(f"https://api.unsplash.com/search/photos?query={encoded_query}&per_page={limit}{extra_params}", headers)
    for item in data.get('results', []):
        results.append({
            "type": "image",
            "source": "Unsplash",
            "title": item.get('description') or item.get('alt_description') or 'Untitled',
            "url": item.get('urls', {}).get('regular') or item.get('urls', {}).get('full'),
            "page_url": item.get('links', {}).get('html'),
            "author": item.get('user', {}).get('name')
        })
    return results

def search_wikimedia(query, limit):
    results = []
    encoded_query = urllib.parse.quote(query)
    # Wikimedia Commons search API
    url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={encoded_query}&gsrnamespace=6&prop=imageinfo&iiprop=url|extmetadata&format=json&gsrlimit={limit}"
    data = make_request(url)
    pages = data.get('query', {}).get('pages', {})
    for page_id, item in pages.items():
        imageinfo = item.get('imageinfo', [{}])[0]
        extmetadata = imageinfo.get('extmetadata', {})
        author = extmetadata.get('Artist', {}).get('value', 'Unknown')
        # strip html tags if present
        import re
        author = re.sub('<[^<]+>', '', author)
        
        results.append({
            "type": "image",
            "source": "Wikimedia Commons",
            "title": item.get('title', 'Untitled').replace('File:', ''),
            "url": imageinfo.get('url', ''),
            "page_url": imageinfo.get('descriptionurl', ''),
            "author": author.strip()
        })
    return results

def search_giphy(query, api_key, limit):
    results = []
    encoded_query = urllib.parse.quote(query)
    data = make_request(f"https://api.giphy.com/v1/gifs/search?api_key={api_key}&q={encoded_query}&limit={limit}")
    for item in data.get('data', []):
        results.append({
            "type": "gif",
            "source": "Giphy",
            "title": item.get('title', 'Untitled'),
            "url": item.get('images', {}).get('original', {}).get('url', ''),
            "page_url": item.get('url', ''),
            "author": item.get('username', 'Unknown')
        })
    return results

def search_jamendo(query, client_id, limit):
    results = []
    encoded_query = urllib.parse.quote(query)
    data = make_request(f"https://api.jamendo.com/v3.0/tracks/?client_id={client_id}&format=json&limit={limit}&search={encoded_query}")
    for item in data.get('results', []):
        results.append({
            "type": "audio",
            "source": "Jamendo",
            "title": item.get('name', 'Untitled'),
            "url": item.get('audio', ''),
            "page_url": item.get('shareurl', ''),
            "author": item.get('artist_name', 'Unknown')
        })
    return results

def main():
    parser = argparse.ArgumentParser(description="Search for media across free repositories.")
    parser.add_argument("query", help="The search term")
    parser.add_argument("--type", choices=['image', 'video', 'audio', 'gif', 'all'], default='all', help="Type of media to search")
    parser.add_argument("--limit", type=int, default=5, help="Number of items to retrieve per platform")
    parser.add_argument("--page", type=int, default=1, help="Page number (supported manually depending on API offset, mostly pseudo-implemented for limits)")
    parser.add_argument("--orientation", choices=['landscape', 'portrait', 'square'], help="Image/Video orientation filter")
    parser.add_argument("--color", help="Color filter")
    parser.add_argument("--env_path", default=".env", help="Path to .env file")
    
    args = parser.parse_args()
    load_env(args.env_path)
    
    pexels_key = os.getenv("PEXELS_API_KEY")
    pixabay_key = os.getenv("PIXABAY_API_KEY")
    unsplash_key = os.getenv("UNSPLASH_ACCESS_KEY") or os.getenv("UNSPLASH_API_KEY")
    freesound_key = os.getenv("FREESOUND_API_KEY")
    giphy_key = os.getenv("GIPHY_API_KEY")
    jamendo_key = os.getenv("JAMENDO_CLIENT_ID")
    
    all_results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as executor:
        futures = []
        
        # Images & Videos
        if args.type in ['image', 'video', 'all']:
            if pexels_key:
                futures.append(executor.submit(search_pexels, args.query, args.type, pexels_key, args.limit, args.orientation, args.color))
            if pixabay_key:
                futures.append(executor.submit(search_pixabay, args.query, args.type, pixabay_key, args.limit, args.orientation, args.color))
                
        # Images only
        if args.type in ['image', 'all']:
            if unsplash_key:
                futures.append(executor.submit(search_unsplash, args.query, unsplash_key, args.limit, args.orientation, args.color))
            # Wikimedia Commons (no API key required)
            futures.append(executor.submit(search_wikimedia, args.query, args.limit))
                
        # Audio
        if args.type in ['audio', 'all']:
            if freesound_key:
                futures.append(executor.submit(search_freesound, args.query, freesound_key, args.limit))
            if jamendo_key:
                futures.append(executor.submit(search_jamendo, args.query, jamendo_key, args.limit))
                
        # GIFs
        if args.type in ['gif', 'all'] and giphy_key:
            futures.append(executor.submit(search_giphy, args.query, giphy_key, args.limit))
            
        # Collect results
        for future in concurrent.futures.as_completed(futures):
            try:
                all_results.extend(future.result())
            except Exception as e:
                import sys
                sys.stderr.write(f"Search task failed: {e}\n")
        
    print(json.dumps(all_results, indent=2))

if __name__ == "__main__":
    main()
