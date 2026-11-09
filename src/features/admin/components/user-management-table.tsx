"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search, ShieldAlert, ShieldCheck } from "lucide-react";

export interface AdminUserItem {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  preferred_language: string;
  onboarding_completed: boolean;
  is_superadmin: boolean;
  created_at: string;
}

export interface UserManagementTableProps {
  users: AdminUserItem[];
}

export function UserManagementTable({ users }: UserManagementTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = users.filter((u) =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            Manajemen Pengguna
          </CardTitle>
        </div>
        <div className="w-64">
          <Input
            placeholder="Cari nama pengguna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs h-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredUsers.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Tidak ada pengguna yang cocok dengan pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-muted-foreground border-b border-border/80 pb-2">
                <tr>
                  <th className="py-2 font-medium">Pengguna</th>
                  <th className="py-2 font-medium">Bahasa</th>
                  <th className="py-2 font-medium">Onboarding</th>
                  <th className="py-2 font-medium">Hak Akses</th>
                  <th className="py-2 font-medium">Terdaftar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="py-2.5 font-medium text-foreground">{u.full_name || "Tanpa Nama"}</td>
                    <td className="py-2.5 uppercase font-mono">{u.preferred_language}</td>
                    <td className="py-2.5">
                      {u.onboarding_completed ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                          Selesai
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Belum
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5">
                      {u.is_superadmin ? (
                        <Badge className="bg-purple-600 text-[10px] text-white">
                          <ShieldAlert className="h-3 w-3 mr-1" />
                          Superadmin
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Kreator Standar</span>
                      )}
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
