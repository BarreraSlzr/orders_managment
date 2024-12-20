import { addTransactionAction, deleteTransactionAction } from '@/app/actions';
import { TransactionsTable } from '@/lib/sql/types';
import { fetcher } from "@/lib/utils/fetcher";
import { Selectable } from 'kysely';
import { useEffect } from 'react';
import useSWR from "swr";
import { Item } from './useInventoryItems';

export type Transaction = Selectable<TransactionsTable>;

export const useTransactions = (selectedItem?: Item | null) => {
    const { data: transactions, mutate: mutateTransactions } = useSWR<Transaction[]>(
        selectedItem ? `/api/inventory/transactions?itemId=${selectedItem.id}` : null,
        fetcher,
        {revalidateOnFocus: false}
    );

    useEffect(() => {
        if (selectedItem) {
            mutateTransactions(); // Fetch transactions for the newly selected item
        }
    }, [selectedItem]);

    const addTransaction = async (formData: FormData) => {
        await addTransactionAction(formData);
        mutateTransactions();
    };

    const deleteTransaction = async (formData: FormData) => {
        await deleteTransactionAction(formData);
        mutateTransactions();
    };

    return {
        transactions: transactions || [],
        addTransaction,
        deleteTransaction,
    }
};      