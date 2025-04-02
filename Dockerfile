FROM browserless/chrome

WORKDIR /app
COPY . .

RUN npm install

CMD ["npm", "start"]