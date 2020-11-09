FROM node:14

WORKDIR /app
COPY . .
RUN npm i
RUN npm i --save pg
ENTRYPOINT ["/bin/sh"]

CMD ["-c", "cp ./chainlink/api.pwd ./build/api.pwd && cp ./chainlink/chainlink.pwd ./build/chainlink.pwd && npm run compile && npm run deploy:testenv && npm run deploy"]