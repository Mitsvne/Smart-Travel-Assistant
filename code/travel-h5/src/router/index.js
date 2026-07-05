import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
    {
        path: '/',
        name: 'Home',
        component: () => import('../views/Home.vue')
    },
    {
        path: '/Chat',
        name: 'Chat',
        component: () => import('../views/Chat.vue')
    },
    {
        path: '/profile',
        name: 'Profile',
        component: () => import('../views/Profile.vue')
    },
    {
        path: '/detail',
        name: 'Detail',
        component: () => import('../views/Detail.vue')
    },
    {
        path: '/history',
        name: 'History',
        component: () => import('../views/History.vue')
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

export default router
