import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:3000/api', // 后端 Rust 地址
  timeout: 10000,
});

export default client;