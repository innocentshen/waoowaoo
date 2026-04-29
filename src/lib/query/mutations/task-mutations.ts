'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys'
import { requestJsonWithError } from './mutation-shared'
import type { TaskItem } from '../hooks/useTaskStatus'

function removeDismissedTasksFromCache(value: unknown, taskIds: Set<string>) {
    if (Array.isArray(value)) {
        return value.filter((task) => {
            return !task || typeof task !== 'object' || !taskIds.has(String((task as TaskItem).id))
        })
    }

    if (value && typeof value === 'object' && taskIds.has(String((value as TaskItem).id))) {
        return null
    }

    return value
}

export function useDismissFailedTasks(projectId: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (taskIds: string[]) => {
            return await requestJsonWithError<{ success: boolean; dismissed: number }>(
                '/api/tasks/dismiss',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskIds }),
                },
                '关闭错误失败',
            )
        },
        onMutate: (taskIds) => {
            const taskIdSet = new Set(taskIds)
            queryClient.setQueriesData(
                { queryKey: queryKeys.tasks.all(projectId), exact: false },
                (value) => removeDismissedTasksFromCache(value, taskIdSet),
            )
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId), exact: false })
        },
    })
}
