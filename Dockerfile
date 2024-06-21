FROM jrottenberg/ffmpeg:4.3-alpine
FROM node:12-alpine

# copy ffmpeg bins from first image
COPY --from=0 / /

WORKDIR /var/app
COPY package*.json ./
RUN npm install --ignore-scripts --prod
COPY . .
EXPOSE 8000

CMD [ "node", "index.js" ]
