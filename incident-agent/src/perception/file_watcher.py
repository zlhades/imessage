"""
File Watcher - Monitor file changes

Uses watchdog to monitor file system changes.
"""

import asyncio
from pathlib import Path
from typing import Callable, List
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent


class FileChangeHandler(FileSystemEventHandler):
    """Handle file system events"""
    
    def __init__(self, callback: Callable):
        self.callback = callback
    
    def on_modified(self, event):
        if isinstance(event, FileModifiedEvent):
            asyncio.create_task(self.callback(str(event.src_path)))


class FileWatcher:
    """Watch files for changes"""
    
    def __init__(self, paths: List[str], on_change: Callable):
        self.paths = paths
        self.on_change = on_change
        self.observer = Observer()
        self.handler = FileChangeHandler(on_change)
        self.running = False
    
    async def start(self):
        """Start watching files"""
        print("📁 Starting file watcher...")
        
        for path in self.paths:
            path_obj = Path(path)
            if path_obj.exists():
                self.observer.schedule(self.handler, str(path_obj), recursive=False)
        
        self.observer.start()
        self.running = True
        print(f"✅ Watching {len(self.paths)} paths")
    
    async def stop(self):
        """Stop watching files"""
        print("📁 Stopping file watcher...")
        self.observer.stop()
        self.observer.join()
        self.running = False
    
    def is_running(self) -> bool:
        """Check if watcher is running"""
        return self.running
