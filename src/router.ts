import type { RouteRecordRaw } from 'vue-router'

import HomePage from './views/HomePage.vue'
import LoginPage from './views/LoginPage.vue'
import DashboardPage from './views/DashboardPage.vue'
import SettingsPage from './views/SettingsPage.vue'
import PublicRestaurantPage from './views/PublicRestaurantPage.vue'
import HistoryPage from './views/HistoryPage.vue'
import EnhancePage from './views/EnhancePage.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomePage },
  { path: '/login', name: 'login', component: LoginPage },
  { path: '/dashboard', name: 'dashboard', component: DashboardPage },
  { path: '/enhance', name: 'enhance', component: EnhancePage },
  { path: '/history', name: 'history', component: HistoryPage },
  { path: '/settings', name: 'settings', component: SettingsPage },
  { path: '/r/:id', name: 'public', component: PublicRestaurantPage }
]
