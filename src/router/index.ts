import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/chat',
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('../views/ChatView.vue'),
    meta: { title: '问数中心' }
  },
  {
    path: '/mapping',
    name: 'mapping',
    component: () => import('../views/MappingView.vue'),
    meta: { title: '语义映射管理' }
  },
  {
    path: '/source',
    name: 'source',
    component: () => import('../views/SourceView.vue'),
    meta: { title: '数据源管理' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;