module.exports = {
  auth: {
    fb: {
        appId: '522522257787842'
      , appSecret: '07be3fa68a843948a175c735455f1d3a'
    }
  , twit: {
        consumerKey: 'lOxYfIvIPWDKt2R2w0vNsA'
      , consumerSecret: 'FNKEidOVlK3Wsq51Hewz1vo01B9j71kGEJD0HJgy4'
    }
  },
  db: {
    mongo: {
      protocol: "mongodb",
      host: "localhost",
      db_name: "suzuri",
    }
  },
  baseURL: "http://10.0.2.1:3000",
  io: {
    client: {
      host: "10.0.2.1",
      port: 3000
    }
  },
  osc: {
    receiver: {
      host: "localhost",
      port: 5555
    },
    sender: {
      host: "localhost",
      port: 5557,
    }
  },
  suzuri_settings: {
    color: "#ff00ff",
    size: 10,
  }
};
