import os
import argparse
import urllib.request
import urllib.parse
import json

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
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        import sys
        sys.stderr.write(f"Request error for {url}: {e}\n")
        return {}

def search_pexels(query, media_type, api_key):
    headers = {"Authorization": api_key}
    results = []
    encoded_query = urllib.parse.quote(query)
    
    if media_type in ['image', 'all']:
        data = make_request(f"https://api.pexels.com/v1/search?query={encoded_query}&per_page=5", headers)
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
        data = make_request(f"https://api.pexels.com/videos/search?query={encoded_query}&per_page=5", headers)
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

def search_pixabay(query, media_type, api_key):
    results = []
    encoded_query = urllib.parse.quote(query)
    
    if media_type in ['image', 'all']:
        data = make_request(f"https://pixabay.com/api/?key={api_key}&q={encoded_query}&per_page=5")
        for item in data.get('hits', []):
            results.append({
                "type": "image",
                "source": "Pixabay",
                "title": item.get('tags', 'Untitled'),
                "url": item.get('largeImageURL'),
                "page_url": item.get('pageURL'),
                "author": item.get('user')
            })
            
    if media_type in ['video', 'all']:
        data = make_request(f"https://pixabay.com/api/videos/?key={api_key}&q={encoded_query}&per_page=5")
        for item in data.get('hits', []):
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

def search_freesound(query, api_key):
    results = []
    encoded_query = urllib.parse.quote(query)
    data = make_request(f"https://freesound.org/apiv2/search/text/?query={encoded_query}&token={api_key}&fields=id,name,url,username,previews")
    for item in data.get('results', [])[:5]:
        results.append({
            "type": "audio",
            "source": "Freesound",
            "title": item.get('name'),
            "url": item.get('previews', {}).get('preview-hq-mp3', ''),
            "page_url": item.get('url'),
            "author": item.get('username')
        })
    return results

def search_unsplash(query, api_key):
    headers = {"Authorization": f"Client-ID {api_key}"}
    results = []
    encoded_query = urllib.parse.quote(query)
    data = make_request(f"https://api.unsplash.com/search/photos?query={encoded_query}&per_page=5", headers)
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

def main():
    parser = argparse.ArgumentParser(description="Search for media across free repositories.")
    parser.add_argument("query", help="The search term")
    parser.add_argument("--type", choices=['image', 'video', 'audio', 'all'], default='all', help="Type of media to search")
    parser.add_argument("--env_path", default=".env", help="Path to .env file")
    
    args = parser.parse_args()
    load_env(args.env_path)
    
    pexels_key = os.getenv("PEXELS_API_KEY")
    pixabay_key = os.getenv("PIXABAY_API_KEY")
    unsplash_key = os.getenv("UNSPLASH_ACCESS_KEY") or os.getenv("UNSPLASH_API_KEY")
    freesound_key = os.getenv("FREESOUND_API_KEY")
    
    all_results = []
    
    if args.type in ['image', 'video', 'all']:
        if pexels_key:
            all_results.extend(search_pexels(args.query, args.type, pexels_key))
        if pixabay_key:
            all_results.extend(search_pixabay(args.query, args.type, pixabay_key))
            
    if args.type in ['image', 'all'] and unsplash_key:
        all_results.extend(search_unsplash(args.query, unsplash_key))
            
    if args.type in ['audio', 'all'] and freesound_key:
        all_results.extend(search_freesound(args.query, freesound_key))
        
    print(json.dumps(all_results, indent=2))

if __name__ == "__main__":
    main()
