import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  vus: 50,
  duration: '19s',
  thresholds: {
    http_req_duration: ['p(90)<=120', 'p(95)<=130'],
    http_req_failed: ['rate<0.01']
    //http_req_duration: ['p(90)<=2', 'p(95)<=3'],
    //http_req_failed: ['rate<0.01']
  }
};

export default function () {

  // ---------- REGISTRO ----------
  // Gera dois usernames únicos: remetente (from) e destinatário (to)
  const generatedFrom = `anderson_from_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const generatedTo = `anderson_to_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Função local para registrar um usuário (evita duplicar código)
  function registerUser(username) {
    const url = 'http://localhost:3000/users/register';
    const payload = JSON.stringify({ username, password: '1234', favorecidos: ['string'] });
    const params = { headers: { accept: '*/*', 'Content-Type': 'application/json' } };
    return http.post(url, payload, params);
  }

  // Registra remetente
  group('registro remetente', function () {
    const res = registerUser(generatedFrom);
    check(res, { 'registro remetente status 201': (r) => r.status === 201 });
  });

  sleep(1);

  // Registra destinatário
  group('registro destinatario', function () {
    const res = registerUser(generatedTo);
    check(res, { 'registro destinatario status 201': (r) => r.status === 201 });
  });

  // Pequena pausa para simular comportamento real entre passos
  sleep(1);

  // ---------- LOGIN ----------
  // Faz login com o remetente e obtém o token
  let token = null;
  group('login do remetente', function () {
    const url = 'http://localhost:3000/users/login';
    const payload = JSON.stringify({ username: generatedFrom, password: '1234' });
    const loginParams = { headers: { accept: '*/*', 'Content-Type': 'application/json' } };
    const res = http.post(url, payload, loginParams);
    // parse seguro
    try {
      const b = res.body ? JSON.parse(res.body) : null; token = b && b.token;

    } catch (e) {
      token = null;
    }
    check(res, {
      'login status 200': (r) => r.status === 200
    });
  });

  sleep(1);

  // ---------- TRANSFERÊNCIA ----------
  group('transferencia entre usuarios', function () {
    const url = 'http://localhost:3000/transfers';
    const value = parseFloat((Math.random() * 99 + 1).toFixed(2));
    const payload = JSON.stringify({ from: generatedFrom, to: generatedTo, value });
    const params = { headers: { accept: '*/*', 'Content-Type': 'application/json' } };
    if (token) params.headers['Authorization'] = `Bearer ${token}`;
    const res = http.post(url, payload, params);
    check(res, { 'transferência com sucesso status 201': (r) => r.status === 201 });
    if (res.status !== 201) {
      // log curto para ajudar a depurar quando ocorrer erro de negócio (ex: usuário não encontrado)
      console.log('transfer failed', res.status, res.body);
    }
  });
}
