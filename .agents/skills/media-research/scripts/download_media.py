import argparse
import urllib.request
import sys
import os

def report_progress(block_num, block_size, total_size):
    if total_size > 0:
        downloaded = block_num * block_size
        progress = min(100, (downloaded / total_size) * 100)
        sys.stdout.write(f"\rDownloading: {progress:.1f}% ({downloaded}/{total_size} bytes)")
        sys.stdout.flush()

def main():
    parser = argparse.ArgumentParser(description="Download media file with a progress bar.")
    parser.add_argument("url", help="Direct URL of the file to download")
    parser.add_argument("output", help="Destination path and filename")
    args = parser.parse_args()

    # Ensure the directory exists
    out_dir = os.path.dirname(os.path.abspath(args.output))
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    print(f"Starting download from {args.url}")
    print(f"Saving to {args.output}")

    # Set user agent to avoid being blocked by some servers
    req = urllib.request.Request(
        args.url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MediaResearchBot/1.0"}
    )

    try:
        with urllib.request.urlopen(req) as response:
            total_size = int(response.info().get("Content-Length", 0))
            
            with open(args.output, 'wb') as f:
                downloaded = 0
                while True:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    report_progress(downloaded // 8192, 8192, total_size)
        
        print("\nDownload completed successfully!")
    except Exception as e:
        print(f"\nFailed to download: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
