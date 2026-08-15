import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import MainView from '@/views/main-view.vue';
import GameView from '@/views/game-view.vue';
import DataSetupView from '@/views/data-setup-view.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'main',
    component: MainView
  },
  {
    path: '/game/:gameType',
    name: 'game',
    component: GameView
  },
  {
    path: '/setup',
    name: 'setup',
    component: DataSetupView,
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
