<template>
  <a-layout class="h-screen">
    <a-layout-sider breakpoint="lg" :width="220">
      <div class="p-4 text-white font-bold text-xl flex items-center gap-2">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">SSE</div>
        Semantic Evolver
      </div>
      <a-menu :default-selected-keys="['chat']" @menu-item-click="handleMenuClick">
        <a-menu-item key="chat">
          <template #icon><icon-message /></template>
          问数中心
        </a-menu-item>
        <a-menu-item key="mapping">
          <template #icon><icon-mind-mapping /></template>
          语义映射
        </a-menu-item>
        <a-menu-item key="source">
          <template #icon><icon-common /></template>
          数据源管理
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout-content class="bg-gray-50 p-6 overflow-y-auto">
      <router-view /> <!-- 这里承载具体页面 -->
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { IconMessage, IconMindMapping, IconCommon } from '@arco-design/web-vue/es/icon';
import { useRouter } from 'vue-router';

const router = useRouter();
const handleMenuClick = (key: string) => {
  router.push({ name: key });
};
</script>