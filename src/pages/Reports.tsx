import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileSpreadsheet,
  Calendar as CalendarIcon,
  BarChart3,
  LineChart,
  PieChart,
  ListOrdered,
  Wallet,
  CreditCard,
} from "lucide-react";
import { useOrders, usePaymentMethods } from "@/hooks/useOrders";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { addDays, format, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  TooltipProps,
} from "recharts";
import { Order, OrderStatus, PaymentStatus } from "@/types";

type ProductSale = {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
};

type PaymentMethodStat = {
  method: string;
  count: number;
  value: number;
};

type DailySales = {
  date: string;
  revenue: number;
  orders: number;
};

const Reports = () => {
  const { data: orders = [] } = useOrders();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { getStatusConfig } = useOrderStatuses();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const filteredOrders = orders.filter((order) => {
    const orderDate = new Date(order.createdAt);
    return dateRange.from && dateRange.to
      ? orderDate >= dateRange.from && orderDate <= dateRange.to
      : dateRange.from
      ? orderDate >= dateRange.from
      : true;
  });

  const totalRevenue = filteredOrders.reduce(
    (total, order) => total + Number(order.total),
    0
  );

  const averageOrderValue = filteredOrders.length
    ? totalRevenue / filteredOrders.length
    : 0;

  const productSales: Record<string, ProductSale> = {};
  filteredOrders.forEach((order) => {
    order.items.forEach((item) => {
      const productId = item.product.id;
      const productName = item.product.name;
      if (!productSales[productId]) {
        productSales[productId] = {
          id: productId,
          name: productName,
          quantity: 0,
          revenue: 0,
        };
      }
      productSales[productId].quantity += item.quantity;
      productSales[productId].revenue += item.price * item.quantity;
    });
  });

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const salesByPaymentMethod: Record<string, PaymentMethodStat> = {};
  filteredOrders.forEach((order) => {
    const method = order.paymentMethod;
    if (!salesByPaymentMethod[method]) {
      salesByPaymentMethod[method] = {
        method,
        count: 0,
        value: 0,
      };
    }
    salesByPaymentMethod[method].count += 1;
    salesByPaymentMethod[method].value += Number(order.total);
  });

  const paymentMethodData = Object.values(salesByPaymentMethod).sort(
    (a, b) => b.value - a.value
  );

  const salesByDay: Record<string, DailySales> = {};
  filteredOrders.forEach((order) => {
    const date = format(new Date(order.createdAt), "dd/MM/yyyy", { locale: ptBR });
    if (!salesByDay[date]) {
      salesByDay[date] = {
        date,
        revenue: 0,
        orders: 0,
      };
    }
    salesByDay[date].revenue += Number(order.total);
    salesByDay[date].orders += 1;
  });

  const timeSeriesData = Object.values(salesByDay).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const pieChartData = paymentMethodData.map((item) => {
    const method = paymentMethods.find(m => m.id === item.method);
    return {
      name: method ? method.name : (
        item.method === "credit_card"
          ? "Cartão de Crédito"
          : item.method === "debit_card"
          ? "Cartão de Débito"
          : item.method === "cash"
          ? "Dinheiro"
          : item.method === "pix"
          ? "PIX"
          : item.method
      ),
      value: item.value,
    };
  });

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE"];

  const handleExportCSV = () => {
    // Preparar dados para CSV
    const csvData = [];
    
    // Cabeçalho
    csvData.push([
      'Número do Pedido',
      'Data',
      'Cliente',
      'Status',
      'Método de Pagamento',
      'Total (R$)',
      'Itens'
    ]);
    
    // Dados dos pedidos
    filteredOrders.forEach(order => {
      const items = order.items.map(item => 
        `${item.product.name} (${item.quantity}x)`
      ).join('; ');
      
      csvData.push([
        order.number,
        format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm'),
        order.customer.name,
        getStatusConfig(order.status).label,
        (() => {
          const method = paymentMethods.find(m => m.id === order.paymentMethod);
          return method ? method.name : order.paymentMethod;
        })(),
        formatCurrency(order.total).replace('R$\u00A0', '').replace('.', '').replace(',', '.'),
        items
      ]);
    });
    
    // Converter para CSV
    const csvContent = csvData.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    // Download do arquivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const dateFrom = dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'inicio';
    const dateTo = dateRange?.to ? format(dateRange.to, 'dd-MM-yyyy') : 'fim';
    link.setAttribute('download', `relatorio-pedidos-${dateFrom}-${dateTo}.csv`);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range || { from: undefined, to: undefined });
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatórios" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start sm:w-auto"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                      {format(dateRange.to, "dd/MM/yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "dd/MM/yyyy")
                  )
                ) : (
                  <span>Selecione o período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                locale={ptBR}
              />
              <div className="flex justify-end gap-2 p-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDateRange({
                      from: subDays(new Date(), 30),
                      to: new Date(),
                    });
                  }}
                >
                  30 dias
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    setDateRange({
                      from: new Date(now.getFullYear(), now.getMonth(), 1),
                      to: now,
                    });
                  }}
                >
                  Este mês
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button onClick={handleExportCSV} variant="outline">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            <span>Exportar CSV</span>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Receita Total
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalRevenue)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
              <ListOrdered className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredOrders.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ticket Médio
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(averageOrderValue)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Produtos Vendidos
              </CardTitle>
              <LineChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(productSales).reduce(
                  (total, product) => total + product.quantity,
                  0
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sales">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sales">Vendas</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos</TabsTrigger>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vendas por Período</CardTitle>
                <CardDescription>
                  Total de vendas e número de pedidos ao longo do tempo
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={timeSeriesData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorRevenue"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#8884d8"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#8884d8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#82ca9d"
                    />
                    <CartesianGrid strokeDasharray="3 3" />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        return name === "revenue"
                          ? formatCurrency(value)
                          : value;
                      }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#8884d8"
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      name="Receita (R$)"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="orders"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      name="Número de Pedidos"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Produtos Mais Vendidos</CardTitle>
                <CardDescription>
                  Top 10 produtos com maior volume de vendas
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProducts}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        return name === "revenue"
                          ? formatCurrency(value)
                          : value;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="quantity" fill="#8884d8" name="Quantidade" />
                    <Bar dataKey="revenue" fill="#82ca9d" name="Receita (R$)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Métodos de Pagamento</CardTitle>
                  <CardDescription>
                    Distribuição de vendas por método de pagamento
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detalhes por Método</CardTitle>
                  <CardDescription>
                    Estatísticas detalhadas de cada método de pagamento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-center">Pedidos</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Média</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentMethodData.map((method) => {
                        const paymentMethod = paymentMethods.find(pm => pm.id === method.method);
                        const methodName = paymentMethod ? paymentMethod.name : (
                          method.method === 'credit_card' ? 'Cartão de Crédito' :
                          method.method === 'debit_card' ? 'Cartão de Débito' :
                          method.method === 'cash' ? 'Dinheiro' :
                          method.method === 'pix' ? 'PIX' : method.method
                        );
                        return (
                          <TableRow key={method.method}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                {methodName}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {method.count}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(method.value)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(method.value / method.count)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Pedidos</CardTitle>
                <CardDescription>
                  Detalhes dos pedidos no período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.slice(0, 10).map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.number}
                        </TableCell>
                        <TableCell>
                          {format(
                            new Date(order.createdAt),
                            "dd/MM/yyyy HH:mm"
                          )}
                        </TableCell>
                        <TableCell>{order.customer.name}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              order.status === "delivered"
                                ? "bg-green-100 text-green-800"
                                : order.status === "preparing"
                                ? "bg-blue-100 text-blue-800"
                                : order.status === "canceled"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {getStatusConfig(order.status).label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(order.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredOrders.length > 10 && (
                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm">
                      Ver todos ({filteredOrders.length})
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Reports;



