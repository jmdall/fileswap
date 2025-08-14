FROM node:18-alpine

# Installer ffmpeg pour la génération de previews vidéo
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY . .

# Exposer le port
EXPOSE 3000

# Commande de démarrage
CMD ["node", "src/server.js"]
