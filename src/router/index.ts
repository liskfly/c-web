import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  // hash 模式：兼容 qrc:// 和 file:// 协议
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/home/Home.vue'),
    },
    {
      path: '/plugin-a',
      name: 'pluginA',
      component: () => import('@/pages/pluginA/PluginA.vue'),
    },
    {
      path: '/plugin-b',
      name: 'pluginB',
      component: () => import('@/pages/pluginB/PluginB.vue'),
    },
    {
      path: '/plugin-c',
      name: 'pluginC',
      component: () => import('@/pages/pluginC/PluginC.vue'),
    },
  ],
})

export default router
