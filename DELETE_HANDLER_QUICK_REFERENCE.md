# Quick Reference: Using DeleteHandler Utility

## Import
```typescript
import { DeleteHandler } from '../utils/deleteHandler';
```

## Basic Usage

### Single Item Delete
```typescript
const handleDeleteItem = async (itemId: string) => {
  const success = await DeleteHandler.handleDelete(
    itemId,
    async () => {
      await supabase
        .from('table_name')
        .delete()
        .eq('id', itemId);
    },
    {
      entityType: 'item',
      scope: 'property', // or 'application'
      onSuccess: () => {
        // Refresh data
        fetchData();
      }
    }
  );
};
```

### With Custom Confirmation Message
```typescript
const success = await DeleteHandler.handleDelete(
  itemId,
  () => deleteApiCall(itemId),
  {
    entityType: 'billing category',
    confirmMessage: 'Are you sure? This will also delete all associated line items.',
    onSuccess: () => refetchData(),
    onError: (error) => console.error(error)
  }
);
```

### Batch Delete
```typescript
const handleDeleteSelected = async (selectedIds: string[]) => {
  const success = await DeleteHandler.handleBatchDelete(
    selectedIds,
    async (ids) => {
      await supabase
        .from('table_name')
        .delete()
        .in('id', ids);
    },
    {
      entityType: 'item',
      confirmMessage: (count) => `Delete ${count} items? This cannot be undone.`,
      onSuccess: () => fetchData()
    }
  );
};
```

## Common Patterns

### Delete with Cascade
```typescript
// Delete parent and children
const success = await DeleteHandler.handleDelete(
  categoryId,
  async () => {
    // Delete children first
    await supabase
      .from('line_items')
      .delete()
      .eq('category_id', categoryId);
    
    // Then delete parent
    await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);
  },
  {
    entityType: 'category and all line items',
    scope: 'property'
  }
);
```

### Delete with State Update
```typescript
const success = await DeleteHandler.handleDelete(
  itemId,
  () => api.deleteItem(itemId),
  {
    entityType: 'item',
    onSuccess: () => {
      // Update local state
      setItems(prev => prev.filter(item => item.id !== itemId));
      // Or refetch from server
      queryClient.invalidateQueries(['items']);
    }
  }
);
```

## Integration with React Query
```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

const handleDelete = async (id: string) => {
  await DeleteHandler.handleDelete(
    id,
    () => deleteItem(id),
    {
      entityType: 'item',
      onSuccess: () => {
        queryClient.invalidateQueries(['items']);
      }
    }
  );
};
```

## Error Handling
```typescript
const success = await DeleteHandler.handleDelete(
  itemId,
  () => deleteApiCall(itemId),
  {
    entityType: 'item',
    onError: (error) => {
      // Custom error handling
      if (error.message.includes('foreign key')) {
        toast.error('Cannot delete: item is in use');
      } else {
        // Log to error tracking service
        Sentry.captureException(error);
      }
    }
  }
);

if (!success) {
  // Handle deletion failure
  console.log('Deletion was cancelled or failed');
}
```

## Skip Confirmation
```typescript
// For programmatic deletes (not triggered by user click)
await DeleteHandler.handleDelete(
  itemId,
  () => deleteApiCall(itemId),
  {
    entityType: 'item',
    skipConfirmation: true // No dialog shown
  }
);
```

## Complete Example
```typescript
import React from 'react';
import { Trash2 } from 'lucide-react';
import { DeleteHandler } from '@/utils/deleteHandler';
import { supabase } from '@/utils/supabase';

interface ItemCardProps {
  item: Item;
  onDeleted: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onDeleted }) => {
  const handleDelete = async () => {
    const success = await DeleteHandler.handleDelete(
      item.id,
      async () => {
        const { error } = await supabase
          .from('items')
          .delete()
          .eq('id', item.id);
        
        if (error) throw error;
      },
      {
        entityType: `item "${item.name}"`,
        scope: 'application',
        confirmMessage: `Permanently delete "${item.name}"? This cannot be undone.`,
        onSuccess: () => {
          onDeleted();
        },
        onError: (error) => {
          console.error('Failed to delete item:', error);
        }
      }
    );

    if (success) {
      console.log('Item deleted successfully');
    }
  };

  return (
    <div className="item-card">
      <h3>{item.name}</h3>
      <button
        onClick={handleDelete}
        className="delete-btn"
        aria-label={`Delete ${item.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};
```
