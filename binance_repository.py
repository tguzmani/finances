import os
from dotenv import load_dotenv
from binance.client import Client
from binance.exceptions import BinanceAPIException
from datetime import datetime


class BinanceRepository:
    def __init__(self):
        # 1. El repositorio carga su propia configuración
        load_dotenv()

        # 2. Obtiene las claves internamente
        self._api_key = os.getenv("BINANCE_API_KEY")
        self._api_secret = os.getenv("BINANCE_SECRET_KEY")

        # 3. Validación interna: Si faltan las claves, fallamos al iniciar
        if not self._api_key or not self._api_secret:
            raise ValueError(
                "ERROR: No se encontraron 'BINANCE_API_KEY' o 'BINANCE_SECRET_KEY' en el archivo .env. "
                "Asegúrate de haber creado el archivo .env en la raíz del proyecto."
            )

        # 4. Inicializamos el cliente
        self.client = Client(self._api_key, self._api_secret)

    def _safe_float(self, value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    def get_asset_overview(self, asset: str) -> dict:
        total_funding = 0.0
        total_earn = 0.0

        # --- 1. Funding Wallet ---
        try:
            funding_res = self.client.funding_wallet(asset=asset)
            if funding_res:
                asset_data = funding_res[0]
                total_funding = self._safe_float(
                    asset_data.get("free")
                ) + self._safe_float(asset_data.get("frozen"))
        except BinanceAPIException:
            pass

        # --- 2. Earn (Nombres corregidos para v1.0.34) ---

        # A) Simple Earn Flexible
        try:
            # CORRECCIÓN AQUÍ: Se agrega '_product_' al nombre
            flex_res = self.client.get_simple_earn_flexible_product_position(
                asset=asset
            )
            if flex_res and "rows" in flex_res:
                for pos in flex_res["rows"]:
                    total_earn += self._safe_float(pos.get("totalAmount"))
        except (BinanceAPIException, AttributeError):
            pass

        # B) Simple Earn Locked (Staking Fijo)
        try:
            # CORRECCIÓN AQUÍ: Se agrega '_product_' al nombre
            locked_res = self.client.get_simple_earn_locked_product_position(
                asset=asset
            )
            if locked_res and "rows" in locked_res:
                for pos in locked_res["rows"]:
                    total_earn += self._safe_float(pos.get("amount"))
        except (BinanceAPIException, AttributeError):
            pass

        return {
            "asset": asset,
            "total_balance": round(total_funding + total_earn, 4),
            "breakdown": {
                "funding": round(total_funding, 4),
                "earn": round(total_earn, 4),
            },
        }
        total_funding = 0.0
        total_earn = 0.0  # Simplificado para sumar flexible + locked aqui

    def get_p2p_history(self, trade_type: str = "SELL", limit: int = 5) -> list:
        try:
            # CORRECCIÓN: Agregamos el prefijo 'get_'
            trades = self.client.get_c2c_trade_history(tradeType=trade_type)

            if not trades:
                return []

            if "data" in trades:
                trades = trades["data"]

            # Ordenar por fecha descendente (más reciente primero)
            trades_sorted = sorted(trades, key=lambda x: x["createTime"], reverse=True)

            results = []
            for t in trades_sorted[:limit]:
                # Convertir timestamp ms a fecha legible
                readable_date = datetime.fromtimestamp(t["createTime"] / 1000).strftime(
                    "%Y-%m-%d %H:%M:%S"
                )

                results.append(
                    {
                        "date": readable_date,
                        "amount": round(self._safe_float(t.get("amount")), 2),
                        "id": t.get("orderNumber")[-4:],
                        "asset": t.get("asset"),
                        "fiat_amount": round(self._safe_float(t.get("totalPrice")), 2),
                        "fiat_symbol": t.get(
                            "fiatSymbol"
                        ),  # Ojo: a veces es 'fiat' o 'fiatSymbol' según la API
                        "status": t.get("orderStatus"),
                        "exchange_rate": round(self._safe_float(t.get("unitPrice")), 2),
                        "counterparty": t.get("counterPartNickName"),
                    }
                )
            return results

        except BinanceAPIException as e:
            print(f"Error P2P: {e}")
            return []
        except AttributeError:
            print(
                "Error: El método get_c2c_trade_history no se encuentra. Verifica tu versión."
            )
            return []


if __name__ == "__main__":
    import json  # Solo para imprimir bonito el diccionario en la prueba

    print("--- 🛠  MODO DE PRUEBA: BINANCE REPOSITORY 🛠 ---")

    try:
        # 1. Instanciación (Buscará el .env automáticamente)
        print("1️⃣  Inicializando repositorio...")
        repo = BinanceRepository()
        print("   ✅ Cliente creado correctamente.")

        # 2. Prueba de Balances (Overview)
        monedas = ["USDT", "USDC"]
        print(f"\n2️⃣  Consultando Balances (Funding + Earn)...")

        balances = []

        for moneda in monedas:
            resultado = repo.get_asset_overview(moneda)
            balances.append(resultado)
            # Imprimimos formateado para leerlo fácil
            print(
                f"   🔹 {moneda}: {resultado['total_balance']} (Funding: {resultado['breakdown']['funding']} | Earn: {resultado['breakdown']['earn']})"
            )

        total = sum(b["total_balance"] for b in balances)
        print(f"   🔹 Total: {total} {balances[0]['asset']}")

        # 3. Prueba de P2P
        print("\n3️⃣  Consultando últimas 3 Compras P2P...")
        compras = repo.get_p2p_history(trade_type="SELL", limit=10)

        if compras:
            for i, c in enumerate(compras, 1):
                print(
                    f"   🔸 [{c['date']}] # {c['id']} - {c['amount']} {c['asset']} @ {c['exchange_rate']} = {c['fiat_amount']} {c['fiat_symbol']}"
                )
        else:
            print("   ⚠️ No se encontraron compras recientes.")

    except ValueError as e:
        print(f"\n❌ ERROR DE CONFIGURACIÓN (.env):")
        print(f"   {e}")
    except Exception as e:
        print(f"\n❌ ERROR INESPERADO:")
        print(f"   {e}")

    print("\n--- 🏁 FIN DE LA PRUEBA 🏁 ---")
