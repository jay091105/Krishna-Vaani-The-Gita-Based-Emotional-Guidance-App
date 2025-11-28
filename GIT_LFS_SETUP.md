# Git LFS Setup Guide

This repository uses **Git LFS** (Large File Storage) to track the large model file (`model.safetensors` which is over 100MB).

## ✅ Git LFS is Already Configured

The following files are already set up:
- `.gitattributes` - Tracks `*.safetensors` and `*.bin` files via Git LFS
- `backend/.gitignore` - Updated to allow Git LFS tracking

## How to Push the Model File to GitHub

### Step 1: Add .gitattributes First
```bash
git add .gitattributes
git commit -m "Add Git LFS configuration"
```

### Step 2: Add All Files (Including Model)
```bash
git add .
```

### Step 3: Verify Model File is Tracked by LFS
```bash
git lfs ls-files
```

You should see `backend/models/gita_emotion_model/model.safetensors` listed.

### Step 4: Commit Everything
```bash
git commit -m "Initial commit with model file via Git LFS"
```

### Step 5: Push to GitHub
```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

**Note**: The first push with Git LFS may take longer as it uploads the large model file.

## For Users Cloning This Repository

When someone clones this repository, they need to:

1. **Install Git LFS** (if not installed):
   - Windows: Download from [git-lfs.github.io](https://git-lfs.github.io/)
   - macOS: `brew install git-lfs`
   - Linux: `sudo apt install git-lfs`

2. **Initialize Git LFS**:
```bash
git lfs install
```

3. **Clone the repository**:
```bash
git clone <repository-url>
```

The model file will be downloaded automatically via Git LFS.

4. **If model file is missing** (shows as pointer file), run:
```bash
git lfs pull
```

## Verify Model File

Check that the model file was downloaded correctly:
```bash
# Check file size (should be > 100MB)
ls -lh backend/models/gita_emotion_model/model.safetensors

# On Windows PowerShell:
Get-Item backend/models/gita_emotion_model/model.safetensors | Select-Object Name, Length
```

If the file is only a few KB, it means Git LFS didn't download it. Run `git lfs pull` again.

## Troubleshooting

### Error: "Git LFS is not installed"
- Install Git LFS from [git-lfs.github.io](https://git-lfs.github.io/)
- Run `git lfs install`

### Error: "File too large" when pushing
- Make sure `.gitattributes` is committed first
- Verify the file is tracked: `git lfs ls-files`
- If the file was already committed without LFS, you need to migrate it:
```bash
git lfs migrate import --include="*.safetensors" --everything
```

### Model file shows as pointer (small file)
- Run `git lfs pull` to download the actual file
- Check your Git LFS quota on GitHub (free accounts have 1GB storage, 1GB bandwidth/month)

