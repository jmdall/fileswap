# Secure File Exchange - Frontend

Interface Angular pour le système d'échange sécurisé de fichiers.

## 🚀 Installation

```powershell
# Installation automatique
.\setup.ps1

# Ou manuellement
npm install
```

## 🏃 Démarrage

```powershell
# Lancer le serveur de développement
ng serve

# Ou avec le proxy configuré
ng serve --proxy-config proxy.conf.json
```

L'application sera disponible sur : http://localhost:4200

## 📋 Prérequis

- Node.js 18+
- Angular CLI 15+
- Backend en cours d'exécution sur le port 3000

## 🏗️ Structure

```
src/
├── app/
│   ├── components/
│   │   ├── home/          # Page d'accueil
│   │   └── exchange/      # Interface d'échange
│   ├── services/
│   │   ├── exchange.service.ts  # API calls
│   │   └── websocket.service.ts # WebSocket
│   └── app.module.ts
├── assets/
├── index.html
└── styles.css
```

## 🎨 Fonctionnalités

- ✅ Création de sessions d'échange
- ✅ Upload de fichiers avec progress bar
- ✅ Drag & Drop
- ✅ Visualisation des métadonnées
- ✅ Double validation
- ✅ WebSocket pour le temps réel
- ✅ Interface responsive

## 🔧 Configuration

Le proxy est configuré dans `proxy.conf.json` pour rediriger les appels API vers le backend :

- `/api/*` → `http://localhost:3000/api/*`
- `/ws` → `ws://localhost:3000/ws`

## 📝 Build pour production

```powershell
ng build --configuration production
```

Les fichiers seront générés dans `dist/secure-file-exchange/`

## 🐛 Debug

Pour voir les logs détaillés :

```powershell
ng serve --verbose
```

Ouvrir les DevTools du navigateur (F12) pour voir :
- Les requêtes réseau
- Les messages WebSocket
- Les logs console

## 🤝 Contribution

1. Créer une branche feature
2. Commiter les changements
3. Pousser vers la branche
4. Créer une Pull Request
