import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  // hash 模式：兼容 qrc:// 和 file:// 协议
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/Home.vue'),
    },
    {
      path: '/plugin-a',
      name: 'pluginA',
      component: () => import('@/pages/PluginA.vue'),
    },
    {
      path: '/plugin-b',
      name: 'pluginB',
      component: () => import('@/pages/PluginB.vue'),
    },
    {
      path: '/plugin-c',
      name: 'pluginC',
      component: () => import('@/pages/PluginC.vue'),
    },
  ],
})

export default router
