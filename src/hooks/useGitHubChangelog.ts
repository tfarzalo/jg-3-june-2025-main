import { useState, useEffect } from 'react';

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  html_url: string;
}

export interface ChangelogEntry {
  id: string;
  date: string;
  type: 'feature' | 'fix' | 'enhancement' | 'update';
  title: string;
  description?: string;
  commitUrl?: string;
}

// Parse commit message to determine type and extract title
function parseCommitMessage(message: string): { type: ChangelogEntry['type']; title: string; description?: string } {
  const lines = message.split('\n').filter(line => line.trim());
  const firstLine = lines[0] || '';
  const description = lines.slice(1).join(' ').trim() || undefined;
  
  let type: ChangelogEntry['type'] = 'update';
  let title = firstLine;
  
  // Detect type from commit message keywords
  const lowerMessage = firstLine.toLowerCase();
  
  if (lowerMessage.includes('fix') || lowerMessage.includes('bug') || lowerMessage.includes('resolve')) {
    type = 'fix';
  } else if (lowerMessage.includes('feat') || lowerMessage.includes('add') || lowerMessage.includes('new')) {
    type = 'feature';
  } else if (lowerMessage.includes('enhance') || lowerMessage.includes('improve') || lowerMessage.includes('update')) {
    type = 'enhancement';
  }
  
  // Remove conventional commit prefixes
  title = title
    .replace(/^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\([^)]+\))?:\s*/i, '')
    .trim();
  
  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  return { type, title, description };
}

export function useGitHubChangelog(owner: string, repo: string, maxCommits: number = 50) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCommits = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch commits from GitHub API (public repos don't need authentication)
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${maxCommits}&sha=main`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        );
        
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const commits: GitHubCommit[] = await response.json();
        
        // Convert commits to changelog entries
        const changelogEntries: ChangelogEntry[] = commits.map(commit => {
          const { type, title, description } = parseCommitMessage(commit.commit.message);
          const commitDate = new Date(commit.commit.author.date);
          
          return {
            id: commit.sha,
            date: commitDate.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            type,
            title,
            description,
            commitUrl: commit.html_url,
          };
        });
        
        setEntries(changelogEntries);
      } catch (err) {
        console.error('Error fetching GitHub commits:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch changelog');
      } finally {
        setLoading(false);
      }
    };

    fetchCommits();
    
    // Optionally refresh every 5 minutes
    const interval = setInterval(fetchCommits, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [owner, repo, maxCommits]);

  return { entries, loading, error };
}
