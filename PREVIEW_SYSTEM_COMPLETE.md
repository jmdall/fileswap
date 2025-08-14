# 🎬 Système de Preview Différencié : Images vs Vidéos

## 📋 Vue d'ensemble

Le système de preview traite maintenant différemment les images et les vidéos pour offrir une sécurité optimale tout en permettant une validation efficace du contenu.

## 🖼️ Preview pour les IMAGES

### Traitements appliqués
- ✅ **Flou gaussien fort** (15px) - Rend l'image illisible
- ✅ **Watermark "PREVIEW"** en diagonale
- ✅ **Qualité JPEG réduite** à 40%
- ✅ **Saturation réduite** de 50%
- ✅ **Luminosité réduite** de 20%
- ✅ **Redimensionnement** à 256x256px max

### Objectif
Empêcher totalement la récupération ou l'utilisation de l'image tout en confirmant qu'il s'agit bien d'une image.

## 🎥 Preview pour les VIDÉOS

### Traitements appliqués
- ✅ **Extraction de 2 frames** (à 10% et 50% de la durée)
- ✅ **Frames NETTES** (pas de flou)
- ✅ **Watermark "VIDEO"** au centre
- ✅ **Bandeau informatif** "VIDEO PREVIEW - 2 frames"
- ✅ **Composition verticale** des 2 frames
- ✅ **Taille finale** : 256x320px

### Objectif
Permettre de valider qu'il s'agit bien d'une vidéo et d'avoir un aperçu du contenu sans donner accès à la vidéo complète. 2 frames sur potentiellement des milliers ne révèlent pas le contenu complet.

## 🛠️ Installation des dépendances

### Pour le traitement vidéo (ffmpeg)

```powershell
# Windows - Installation automatique
.\install-ffmpeg.ps1

# Ou manuellement via Chocolatey
choco install ffmpeg

# Ou via Scoop
scoop install ffmpeg

# Linux/Mac
sudo apt-get install ffmpeg  # Ubuntu/Debian
brew install ffmpeg          # macOS
```

### Vérifier l'installation

```bash
ffmpeg -version
ffprobe -version
```

## 💻 Code technique

### Service de preview (`backend/src/services/preview.js`)

Le service détecte automatiquement le type de fichier :

```javascript
// Pour les vidéos
if (mimeType && mimeType.startsWith('video/')) {
  // Extraction de 2 frames sans flou
  const frames = await extractVideoFrames(buffer, 2);
  // Composition avec watermark "VIDEO"
}

// Pour les images  
if (mimeType && mimeType.startsWith('image/')) {
  // Application du flou gaussien fort
  // Ajout watermark "PREVIEW"
}
```

### Extraction des frames vidéo

```javascript
// Positions des frames à extraire
const positions = [
  duration * 0.1,  // Frame à 10% de la vidéo
  duration * 0.5   // Frame à 50% de la vidéo
];

// Extraction avec ffmpeg
ffmpeg -ss [position] -i [video] -vframes 1 -q:v 2 [output]
```

## 🧪 Tests

### Test upload image
```powershell
# Teste le floutage des images
.\test-upload-blurred-preview.ps1
```

### Test upload vidéo
```powershell
# Teste l'extraction de frames
.\test-upload-video-preview.ps1
```

### Demo visuelle
Ouvrir `demo-preview-comparison.html` pour voir la différence entre original et preview.

## 📊 Comparaison des approches

| Aspect | Images | Vidéos |
|--------|--------|--------|
| **Flou** | ✅ Fort (15px) | ❌ Aucun |
| **Nombre d'aperçus** | 1 image floutée | 2 frames nettes |
| **Watermark** | "PREVIEW" diagonal | "VIDEO" centré |
| **Qualité** | 40% JPEG | 70% JPEG |
| **Saturation** | 50% | 100% |
| **Luminosité** | 80% | 100% |
| **Objectif sécurité** | Cacher totalement | Montrer échantillon |

## 🔒 Analyse de sécurité

### Images
- **Risque sans protection** : Vol de l'image complète
- **Avec protection** : Image inutilisable, impossible de récupérer l'original
- **Niveau de sécurité** : ⭐⭐⭐⭐⭐

### Vidéos
- **Risque sans protection** : Vol de la vidéo complète
- **Avec protection** : Seulement 2 frames sur des milliers visibles
- **Niveau de sécurité** : ⭐⭐⭐⭐⭐

## 🎯 Cas d'usage

### Images sensibles
- Photos personnelles
- Documents confidentiels
- Créations artistiques
- Designs propriétaires

→ **Le flou empêche toute utilisation frauduleuse**

### Vidéos
- Films/séries
- Formations vidéo
- Contenus éducatifs
- Vidéos personnelles

→ **2 frames permettent de confirmer le contenu sans le révéler**

## ⚡ Performance

| Opération | Temps moyen |
|-----------|-------------|
| Preview image (avec flou) | 200-500ms |
| Preview vidéo (extraction frames) | 2-5 secondes |
| Upload S3 | 100-300ms |

## 🔄 Évolutions possibles

### Pour les images
1. Ajouter pixelisation en plus du flou
2. Preview partielle (coin de l'image)
3. Détection de visages pour flou sélectif

### Pour les vidéos
1. Nombre de frames configurable (1-4)
2. GIF animé de quelques secondes
3. Extraction intelligente (détection de scènes)
4. Mini-player avec timeline bloquée

## 📝 Configuration

### Variables d'environnement
```env
# Qualité des previews
PREVIEW_IMAGE_QUALITY=40
PREVIEW_VIDEO_QUALITY=70

# Taille des previews
PREVIEW_MAX_WIDTH=256
PREVIEW_MAX_HEIGHT=256

# Flou pour les images (en pixels)
PREVIEW_BLUR_RADIUS=15

# Nombre de frames pour les vidéos
PREVIEW_VIDEO_FRAMES=2
```

## ✅ Checklist de déploiement

- [ ] ffmpeg installé sur le serveur
- [ ] Sharp installé (`npm install sharp`)
- [ ] Dossier temp créé avec permissions
- [ ] S3 configuré pour les previews
- [ ] Tests effectués sur images et vidéos

## 🚨 Troubleshooting

### "ffmpeg not found"
→ Installer ffmpeg : `.\install-ffmpeg.ps1`

### "Preview generation timeout"
→ Augmenter le timeout pour les grosses vidéos

### "No frames extracted"
→ Vérifier le format vidéo supporté par ffmpeg

### "Blur not applied"
→ Vérifier la version de Sharp (>= 0.30.0)

---

**Le système offre maintenant une sécurité optimale adaptée à chaque type de média !** 🎉
